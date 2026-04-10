import {
  prisma, parseDateFilter, todayStartKst,
  VALID_MSG_TYPES, MsgType, buildWhereSql,
  resolveLogTables, buildLogUnionSql,
} from './shared';
import { MessageDto } from './dto';

export type MessageWeeklyReportInput = MessageDto.MessageWeeklyReportInput;

export async function messageWeeklyReport(input: MessageWeeklyReportInput): Promise<string> {
  let thisWeekStart: Date;
  if (input.weekStartDate && /^\d{4}-\d{2}-\d{2}$/.test(input.weekStartDate)) {
    thisWeekStart = new Date(input.weekStartDate + 'T00:00:00Z');
  } else if (input.weekStartDate) {
    thisWeekStart = parseDateFilter(input.weekStartDate)!;
  } else {
    const today = todayStartKst();
    thisWeekStart = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  }
  const thisWeekEnd = new Date(thisWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

  const prevWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevWeekEnd = new Date(thisWeekStart.getTime() - 1);

  const channels: MsgType[] = [...VALID_MSG_TYPES];
  const [thisLogTables, prevLogTables] = await Promise.all([
    resolveLogTables(channels, thisWeekStart, thisWeekEnd),
    resolveLogTables(channels, prevWeekStart, prevWeekEnd),
  ]);

  const thisWhere = buildWhereSql({ dateFrom: thisWeekStart, dateTo: thisWeekEnd });
  const thisUnion = buildLogUnionSql(thisLogTables, 'create_date, message_state', thisWhere);
  const thisDailySql = `SELECT DATE(create_date) as d, message_state, COUNT(*) as cnt FROM (${thisUnion.fragment}) t GROUP BY d, message_state ORDER BY d`;
  const thisChannelSql = `SELECT _channel, message_state, COUNT(*) as cnt FROM (${thisUnion.fragment}) t GROUP BY _channel, message_state`;

  const prevWhere = buildWhereSql({ dateFrom: prevWeekStart, dateTo: prevWeekEnd });
  const prevUnion = buildLogUnionSql(prevLogTables, 'message_state', prevWhere);
  const prevSql = `SELECT message_state, COUNT(*) as cnt FROM (${prevUnion.fragment}) t GROUP BY message_state`;

  const [thisDailyResult, thisChannelResult, prevResult] = await Promise.all([
    prisma.$queryRawUnsafe<{ d: Date; message_state: number; cnt: bigint }[]>(thisDailySql, ...thisUnion.params),
    prisma.$queryRawUnsafe<{ _channel: string; message_state: number; cnt: bigint }[]>(thisChannelSql, ...thisUnion.params),
    prisma.$queryRawUnsafe<{ message_state: number; cnt: bigint }[]>(prevSql, ...prevUnion.params),
  ]);

  // 일별 표
  const dailyMap: Record<string, { total: number; success: number; fail: number; pending: number }> = {};
  for (const row of thisDailyResult) {
    const dateKey = row.d instanceof Date
      ? `${row.d.getUTCFullYear()}-${String(row.d.getUTCMonth() + 1).padStart(2, '0')}-${String(row.d.getUTCDate()).padStart(2, '0')}`
      : String(row.d);
    if (!dailyMap[dateKey]) dailyMap[dateKey] = { total: 0, success: 0, fail: 0, pending: 0 };
    const cnt = Number(row.cnt);
    dailyMap[dateKey].total += cnt;
    if (row.message_state === 2) dailyMap[dateKey].success += cnt;
    else if (row.message_state === 3) dailyMap[dateKey].fail += cnt;
    else dailyMap[dateKey].pending += cnt;
  }

  // 채널별
  const channelMap: Record<string, { total: number; success: number; fail: number }> = {};
  let thisTotal = 0, thisSuccess = 0, thisFail = 0;
  for (const row of thisChannelResult) {
    if (!channelMap[row._channel]) channelMap[row._channel] = { total: 0, success: 0, fail: 0 };
    const cnt = Number(row.cnt);
    channelMap[row._channel].total += cnt;
    thisTotal += cnt;
    if (row.message_state === 2) { channelMap[row._channel].success += cnt; thisSuccess += cnt; }
    else if (row.message_state === 3) { channelMap[row._channel].fail += cnt; thisFail += cnt; }
  }

  // 전주
  let prevTotal = 0, prevSuccess = 0, prevFail = 0;
  for (const row of prevResult) {
    const cnt = Number(row.cnt);
    prevTotal += cnt;
    if (row.message_state === 2) prevSuccess += cnt;
    else if (row.message_state === 3) prevFail += cnt;
  }

  const thisSuccessRate = (thisSuccess + thisFail) > 0 ? Math.round(thisSuccess / (thisSuccess + thisFail) * 1000) / 10 : 0;
  const prevSuccessRate = (prevSuccess + prevFail) > 0 ? Math.round(prevSuccess / (prevSuccess + prevFail) * 1000) / 10 : 0;

  function changeRate(cur: number, prev: number): number | null {
    if (prev === 0) return cur > 0 ? 100 : null;
    return Math.round((cur - prev) / prev * 1000) / 10;
  }

  const fmtRate = (r: number | null) => r != null ? (r > 0 ? '+' : '') + r + '%' : '-';

  const weekStartStr = `${thisWeekStart.getUTCFullYear()}-${String(thisWeekStart.getUTCMonth() + 1).padStart(2, '0')}-${String(thisWeekStart.getUTCDate()).padStart(2, '0')}`;
  const weekEndStr = `${thisWeekEnd.getUTCFullYear()}-${String(thisWeekEnd.getUTCMonth() + 1).padStart(2, '0')}-${String(thisWeekEnd.getUTCDate()).padStart(2, '0')}`;
  const successRateDiff = Math.round((thisSuccessRate - prevSuccessRate) * 10) / 10;

  const lines = [
    `[주간 발송 리포트] ${weekStartStr} ~ ${weekEndStr}`,
    '',
    '■ 전체 요약',
    `  이번 주: ${thisTotal}건 (성공:${thisSuccess} 실패:${thisFail}) 성공률:${thisSuccessRate}%`,
    `  전    주: ${prevTotal}건 (성공:${prevSuccess} 실패:${prevFail}) 성공률:${prevSuccessRate}%`,
    '',
    '■ 전주 대비 증감',
    `  발송량: ${fmtRate(changeRate(thisTotal, prevTotal))}`,
    `  성공건: ${fmtRate(changeRate(thisSuccess, prevSuccess))}`,
    `  실패건: ${fmtRate(changeRate(thisFail, prevFail))}`,
    `  성공률: ${(successRateDiff > 0 ? '+' : '') + successRateDiff}%p`,
    '',
    '■ 일별 추이',
    '  날짜       | 전체  | 성공  | 실패  | 성공률',
    '  -----------|-------|-------|-------|-------',
  ];
  for (const [date, val] of Object.entries(dailyMap)) {
    const sr = (val.success + val.fail) > 0 ? Math.round(val.success / (val.success + val.fail) * 1000) / 10 : 0;
    lines.push(`  ${date} | ${String(val.total).padStart(5)} | ${String(val.success).padStart(5)} | ${String(val.fail).padStart(5)} | ${sr}%`);
  }
  if (Object.keys(channelMap).length > 0) {
    lines.push('', '■ 채널별 집계');
    for (const [ch, val] of Object.entries(channelMap)) {
      const sr = (val.success + val.fail) > 0 ? Math.round(val.success / (val.success + val.fail) * 1000) / 10 : 0;
      lines.push(`  ${ch}: ${val.total}건 (성공:${val.success} 실패:${val.fail}) 성공률:${sr}%`);
    }
  }
  return lines.join('\n');
}
