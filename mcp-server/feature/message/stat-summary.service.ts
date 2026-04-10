import {
  prisma, KST_OFFSET_MS, parseDateFilter, todayStartKst,
  VALID_MSG_TYPES, MsgType, buildWhereSql,
  resolveLogTables, buildLogUnionSql,
} from './shared';
import { MessageDto } from './dto';

export type MessageStatSummaryInput = MessageDto.MessageStatSummaryInput;

export async function messageStatSummary(input: MessageStatSummaryInput): Promise<string> {
  const dateFrom = parseDateFilter(input.dateFrom) ?? todayStartKst();
  const dateTo = parseDateFilter(input.dateTo) ?? new Date(Date.now() + KST_OFFSET_MS);
  const groupByMode = (input.groupBy ?? 'channel').toLowerCase();
  const channels: MsgType[] = [...VALID_MSG_TYPES];
  const logTables = await resolveLogTables(channels, dateFrom, dateTo);
  const where = buildWhereSql({ dateFrom, dateTo });

  let groupSelect: string;
  let groupColumn: string;
  if (groupByMode === 'hour') {
    groupSelect = 'HOUR(create_date) as grp';
    groupColumn = 'grp';
  } else if (groupByMode === 'day') {
    groupSelect = 'DATE(create_date) as grp';
    groupColumn = 'grp';
  } else {
    groupSelect = '_channel as grp';
    groupColumn = 'grp';
  }

  const union = buildLogUnionSql(logTables, `create_date, message_state`, where);
  const sql = `SELECT ${groupSelect}, message_state, COUNT(*) as cnt FROM (${union.fragment}) t GROUP BY ${groupColumn}, message_state ORDER BY ${groupColumn}`;

  const rows = await prisma.$queryRawUnsafe<{ grp: unknown; message_state: number; cnt: bigint }[]>(sql, ...union.params);

  let totalSuccess = 0, totalFail = 0, totalPending = 0, totalProcessing = 0;
  const groups: Record<string, { success: number; fail: number; pending: number; processing: number; total: number }> = {};

  for (const row of rows) {
    const key = String(row.grp);
    if (!groups[key]) groups[key] = { success: 0, fail: 0, pending: 0, processing: 0, total: 0 };
    const cnt = Number(row.cnt);
    groups[key].total += cnt;

    if (row.message_state === 2) { groups[key].success += cnt; totalSuccess += cnt; }
    else if (row.message_state === 3) { groups[key].fail += cnt; totalFail += cnt; }
    else if (row.message_state === 0) { groups[key].pending += cnt; totalPending += cnt; }
    else if (row.message_state === 1) { groups[key].processing += cnt; totalProcessing += cnt; }
  }

  const total = totalSuccess + totalFail + totalPending + totalProcessing;
  const successRate = (totalSuccess + totalFail) > 0
    ? Math.round(totalSuccess / (totalSuccess + totalFail) * 1000) / 10
    : 0;

  const lines = [
    `발송 통계 요약 (groupBy: ${groupByMode})`,
    `전체: ${total}건 | 성공: ${totalSuccess} | 실패: ${totalFail} | 대기: ${totalPending} | 처리중: ${totalProcessing}`,
    `성공률: ${successRate}%`,
    '',
  ];
  for (const [key, val] of Object.entries(groups)) {
    const sr = (val.success + val.fail) > 0
      ? Math.round(val.success / (val.success + val.fail) * 1000) / 10
      : 0;
    const label = groupByMode === 'hour' ? `${key}시` : key;
    lines.push(`  ${label}: ${val.total}건 (성공:${val.success} 실패:${val.fail} 대기:${val.pending}) 성공률:${sr}%`);
  }
  return lines.join('\n');
}
