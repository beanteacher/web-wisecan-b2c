import {
  prisma, parseDateFilter,
  VALID_MSG_TYPES, MsgType, buildWhereSql,
  resolveLogTables, buildLogUnionSql,
} from './shared';
import { MessageDto } from './dto';

export type MessageTrendCompareInput = MessageDto.MessageTrendCompareInput;

async function periodStats(dateFrom: Date, dateTo: Date, groupByMode: string) {
  const channels: MsgType[] = [...VALID_MSG_TYPES];
  const logTables = await resolveLogTables(channels, dateFrom, dateTo);
  const where = buildWhereSql({ dateFrom, dateTo });

  let groupSelect: string;
  if (groupByMode === 'hour') {
    groupSelect = 'HOUR(create_date) as grp';
  } else {
    groupSelect = '_channel as grp';
  }

  const union = buildLogUnionSql(logTables, 'create_date, message_state', where);
  const sql = `SELECT ${groupSelect}, message_state, COUNT(*) as cnt FROM (${union.fragment}) t GROUP BY grp, message_state ORDER BY grp`;

  const rows = await prisma.$queryRawUnsafe<{ grp: unknown; message_state: number; cnt: bigint }[]>(sql, ...union.params);

  let total = 0, success = 0, fail = 0, pending = 0;
  const groups: Record<string, { total: number; success: number; fail: number; pending: number }> = {};

  for (const row of rows) {
    const key = String(row.grp);
    if (!groups[key]) groups[key] = { total: 0, success: 0, fail: 0, pending: 0 };
    const cnt = Number(row.cnt);
    groups[key].total += cnt;
    total += cnt;
    if (row.message_state === 2) { groups[key].success += cnt; success += cnt; }
    else if (row.message_state === 3) { groups[key].fail += cnt; fail += cnt; }
    else { groups[key].pending += cnt; pending += cnt; }
  }

  const successRate = (success + fail) > 0
    ? Math.round(success / (success + fail) * 1000) / 10 : 0;

  const breakdown = Object.entries(groups).map(([key, val]) => ({
    group: key,
    ...val,
    successRate: (val.success + val.fail) > 0
      ? Math.round(val.success / (val.success + val.fail) * 1000) / 10 : 0,
  }));

  return { total, success, fail, pending, successRate, breakdown };
}

export async function messageTrendCompare(input: MessageTrendCompareInput): Promise<string> {
  const aFrom = parseDateFilter(input.periodA_from);
  const aTo = parseDateFilter(input.periodA_to);
  const bFrom = parseDateFilter(input.periodB_from);
  const bTo = parseDateFilter(input.periodB_to);

  if (!aFrom || !aTo || !bFrom || !bTo) {
    throw new Error('periodA_from, periodA_to, periodB_from, periodB_to는 모두 필수입니다.');
  }

  const groupByMode = (input.groupBy ?? 'channel').toLowerCase();

  const [statsA, statsB] = await Promise.all([
    periodStats(aFrom, aTo, groupByMode),
    periodStats(bFrom, bTo, groupByMode),
  ]);

  function changeRate(cur: number, prev: number): number | null {
    if (prev === 0) return cur > 0 ? 100 : null;
    return Math.round((cur - prev) / prev * 1000) / 10;
  }

  const fmtRate = (r: number | null) => r != null ? (r > 0 ? '+' : '') + r + '%' : '-';

  const allGroups = new Set([
    ...statsA.breakdown.map(b => b.group),
    ...statsB.breakdown.map(b => b.group),
  ]);

  const successRateDiff = Math.round((statsB.successRate - statsA.successRate) * 10) / 10;

  const lines = [
    `[기간 비교] (groupBy: ${groupByMode})`,
    '',
    '■ 전체 요약',
    `  기간A (${input.periodA_from} ~ ${input.periodA_to}): ${statsA.total}건 (성공:${statsA.success} 실패:${statsA.fail}) 성공률:${statsA.successRate}%`,
    `  기간B (${input.periodB_from} ~ ${input.periodB_to}): ${statsB.total}건 (성공:${statsB.success} 실패:${statsB.fail}) 성공률:${statsB.successRate}%`,
    '',
    '■ 증감',
    `  발송량: ${fmtRate(changeRate(statsB.total, statsA.total))}`,
    `  성공건: ${fmtRate(changeRate(statsB.success, statsA.success))}`,
    `  실패건: ${fmtRate(changeRate(statsB.fail, statsA.fail))}`,
    `  성공률: ${(successRateDiff > 0 ? '+' : '') + successRateDiff}%p`,
    '',
    '■ 그룹별 비교',
    `  ${'그룹'.padEnd(8)} | A건수  | A성공률 | B건수  | B성공률 | 증감`,
    `  ${''.padEnd(8, '-')}|--------|--------|--------|--------|------`,
  ];
  for (const group of [...allGroups].sort()) {
    const a = statsA.breakdown.find(b => b.group === group) ?? { total: 0, success: 0, fail: 0, pending: 0, successRate: 0 };
    const b = statsB.breakdown.find(b => b.group === group) ?? { total: 0, success: 0, fail: 0, pending: 0, successRate: 0 };
    const label = groupByMode === 'hour' ? `${group}시`.padEnd(8) : group.padEnd(8);
    const chg = fmtRate(changeRate(b.total, a.total));
    lines.push(`  ${label} | ${String(a.total).padStart(6)} | ${String(a.successRate).padStart(5)}% | ${String(b.total).padStart(6)} | ${String(b.successRate).padStart(5)}% | ${chg}`);
  }
  return lines.join('\n');
}
