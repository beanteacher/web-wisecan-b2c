import {
  prisma, parseDateFilter, yesterdayStartKst,
  VALID_MSG_TYPES, MsgType, buildWhereSql,
  resolveLogTables, buildLogUnionSql, RESULT_CODE_MAP,
} from './shared';
import { MessageDto } from './dto';

export type MessageDailyReportInput = MessageDto.MessageDailyReportInput;

export async function messageDailyReport(input: MessageDailyReportInput): Promise<string> {
  let dayStart: Date;
  if (input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    dayStart = new Date(input.date + 'T00:00:00Z');
  } else if (input.date) {
    dayStart = parseDateFilter(input.date)!;
  } else {
    dayStart = yesterdayStartKst();
  }
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  const channels: MsgType[] = [...VALID_MSG_TYPES];
  const logTables = await resolveLogTables(channels, dayStart, dayEnd);
  const where = buildWhereSql({ dateFrom: dayStart, dateTo: dayEnd });

  const union = buildLogUnionSql(logTables, 'create_date, message_state, result_code, result_deliver_date', where);

  const channelSql = `SELECT _channel, message_state, COUNT(*) as cnt FROM (${union.fragment}) t GROUP BY _channel, message_state`;

  const failWhere = buildWhereSql({ dateFrom: dayStart, dateTo: dayEnd, messageState: 3 });
  const failUnion = buildLogUnionSql(logTables, 'result_code', failWhere);
  const failCodeSql = `SELECT result_code, COUNT(*) as cnt FROM (${failUnion.fragment}) t GROUP BY result_code ORDER BY cnt DESC LIMIT 5`;

  const hourlySql = `SELECT HOUR(create_date) as h, COUNT(*) as cnt FROM (${union.fragment}) t GROUP BY h ORDER BY h`;

  const deliveryWhere = buildWhereSql({ dateFrom: dayStart, dateTo: dayEnd, messageState: 2 });
  const deliveryUnion = buildLogUnionSql(logTables, 'create_date, result_deliver_date', deliveryWhere);
  const avgDeliverySql = `SELECT AVG(TIMESTAMPDIFF(SECOND, create_date, result_deliver_date)) as avg_sec FROM (${deliveryUnion.fragment}) t WHERE result_deliver_date IS NOT NULL`;

  const [channelResult, failCodeResult, hourlyResult, deliveryResult] = await Promise.all([
    prisma.$queryRawUnsafe<{ _channel: string; message_state: number; cnt: bigint }[]>(channelSql, ...union.params),
    prisma.$queryRawUnsafe<{ result_code: string | null; cnt: bigint }[]>(failCodeSql, ...failUnion.params),
    prisma.$queryRawUnsafe<{ h: number; cnt: bigint }[]>(hourlySql, ...union.params),
    prisma.$queryRawUnsafe<{ avg_sec: number | null }[]>(avgDeliverySql, ...deliveryUnion.params),
  ]);

  const byChannel: Record<string, { total: number; success: number; fail: number; pending: number }> = {};
  let total = 0, success = 0, fail = 0, pending = 0;

  for (const row of channelResult) {
    const ch = row._channel;
    if (!byChannel[ch]) byChannel[ch] = { total: 0, success: 0, fail: 0, pending: 0 };
    const cnt = Number(row.cnt);
    byChannel[ch].total += cnt;
    total += cnt;
    if (row.message_state === 2) { byChannel[ch].success += cnt; success += cnt; }
    else if (row.message_state === 3) { byChannel[ch].fail += cnt; fail += cnt; }
    else { byChannel[ch].pending += cnt; pending += cnt; }
  }

  const successRate = (success + fail) > 0 ? Math.round(success / (success + fail) * 1000) / 10 : 0;
  const avgDeliverySeconds = deliveryResult[0]?.avg_sec != null ? Math.round(deliveryResult[0].avg_sec * 10) / 10 : null;
  const dateStr = `${dayStart.getUTCFullYear()}-${String(dayStart.getUTCMonth() + 1).padStart(2, '0')}-${String(dayStart.getUTCDate()).padStart(2, '0')}`;

  const lines = [
    `[${dateStr}] 일간 발송 리포트`,
    `전체: ${total}건 | 성공: ${success} | 실패: ${fail} | 대기: ${pending}`,
    `성공률: ${successRate}%`,
    avgDeliverySeconds != null ? `평균 수신 소요시간: ${avgDeliverySeconds}초` : '평균 수신 소요시간: (데이터 없음)',
    '',
    '채널별:',
    ...Object.entries(byChannel).map(([ch, val]) => {
      const sr = (val.success + val.fail) > 0 ? Math.round(val.success / (val.success + val.fail) * 1000) / 10 : 0;
      return `  ${ch}: ${val.total}건 (성공:${val.success} 실패:${val.fail}) 성공률:${sr}%`;
    }),
    '',
    'Top 실패코드:',
    ...failCodeResult.map(r => {
      const code = r.result_code ?? '(없음)';
      const info = RESULT_CODE_MAP[code];
      return `  ${code}: ${Number(r.cnt)}건 - ${info?.description ?? '알 수 없음'}`;
    }),
    '',
    '시간대별 발송량:',
    ...hourlyResult.map(r => `  ${String(r.h).padStart(2, '0')}시: ${Number(r.cnt)}건`),
  ];
  return lines.join('\n');
}
