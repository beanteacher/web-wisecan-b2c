import {
  prisma, KST_OFFSET_MS, parseDateFilter, todayStartKst,
  VALID_MSG_TYPES, MsgType, buildWhereSql,
  resolveLogTables, buildLogUnionSql,
} from './shared';
import { MessageDto } from './dto';

export type MessageChannelBreakdownInput = MessageDto.MessageChannelBreakdownInput;

export async function messageChannelBreakdown(input: MessageChannelBreakdownInput): Promise<string> {
  const dateFrom = parseDateFilter(input.dateFrom) ?? todayStartKst();
  const dateTo = parseDateFilter(input.dateTo) ?? new Date(Date.now() + KST_OFFSET_MS);
  const channels: MsgType[] = [...VALID_MSG_TYPES];
  const logTables = await resolveLogTables(channels, dateFrom, dateTo);
  const where = buildWhereSql({ dateFrom, dateTo });

  const union = buildLogUnionSql(logTables, 'msg_sub_type, message_state', where);
  const sql = `SELECT _channel, msg_sub_type, message_state, COUNT(*) as cnt FROM (${union.fragment}) t GROUP BY _channel, msg_sub_type, message_state ORDER BY _channel, msg_sub_type`;

  const rows = await prisma.$queryRawUnsafe<{ _channel: string; msg_sub_type: string; message_state: number; cnt: bigint }[]>(sql, ...union.params);

  const tree: Record<string, {
    total: number; success: number; fail: number; pending: number;
    subTypes: Record<string, { total: number; success: number; fail: number; pending: number }>;
  }> = {};
  let grandTotal = 0, grandSuccess = 0, grandFail = 0;

  for (const row of rows) {
    const ch = row._channel;
    const sub = row.msg_sub_type;
    const cnt = Number(row.cnt);

    if (!tree[ch]) tree[ch] = { total: 0, success: 0, fail: 0, pending: 0, subTypes: {} };
    if (!tree[ch].subTypes[sub]) tree[ch].subTypes[sub] = { total: 0, success: 0, fail: 0, pending: 0 };

    tree[ch].total += cnt;
    tree[ch].subTypes[sub].total += cnt;
    grandTotal += cnt;

    if (row.message_state === 2) {
      tree[ch].success += cnt; tree[ch].subTypes[sub].success += cnt; grandSuccess += cnt;
    } else if (row.message_state === 3) {
      tree[ch].fail += cnt; tree[ch].subTypes[sub].fail += cnt; grandFail += cnt;
    } else {
      tree[ch].pending += cnt; tree[ch].subTypes[sub].pending += cnt;
    }
  }

  const grandSuccessRate = (grandSuccess + grandFail) > 0
    ? Math.round(grandSuccess / (grandSuccess + grandFail) * 1000) / 10 : 0;

  const lines = [
    `[채널별 세부유형 분해]`,
    `전체: ${grandTotal}건 | 성공: ${grandSuccess} | 실패: ${grandFail} | 성공률: ${grandSuccessRate}%`,
    '',
    '  채널  | 유형  | 건수   | 성공  | 실패  | 성공률 | 비중',
    '  ------|-------|--------|-------|-------|--------|------',
  ];
  for (const [ch, val] of Object.entries(tree)) {
    const sr = (val.success + val.fail) > 0 ? Math.round(val.success / (val.success + val.fail) * 1000) / 10 : 0;
    const share = grandTotal > 0 ? Math.round(val.total / grandTotal * 1000) / 10 : 0;
    lines.push(`  ${ch.padEnd(5)} | (소계) | ${String(val.total).padStart(6)} | ${String(val.success).padStart(5)} | ${String(val.fail).padStart(5)} | ${sr}% | ${share}%`);
    for (const [sub, sv] of Object.entries(val.subTypes)) {
      const ssr = (sv.success + sv.fail) > 0 ? Math.round(sv.success / (sv.success + sv.fail) * 1000) / 10 : 0;
      const sShare = val.total > 0 ? Math.round(sv.total / val.total * 1000) / 10 : 0;
      lines.push(`        | ${sub.padEnd(5)} | ${String(sv.total).padStart(6)} | ${String(sv.success).padStart(5)} | ${String(sv.fail).padStart(5)} | ${ssr}% | ${sShare}%`);
    }
  }
  return lines.join('\n');
}
