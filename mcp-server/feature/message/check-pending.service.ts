import {
  prisma, KST_OFFSET_MS, formatKst,
  VALID_MSG_TYPES, MsgType, resolveChannelFilter,
  buildWhereSql, buildUnionSql,
} from './shared';
import { MessageDto } from './dto';

export type MessageCheckPendingInput = MessageDto.MessageCheckPendingInput;

export async function messageCheckPending(input: MessageCheckPendingInput): Promise<string> {
  const { channels } = resolveChannelFilter(input.msgType);
  const where = buildWhereSql({ messageStateIn: [0, 1] });

  const union = buildUnionSql(channels, 'create_date, message_state', where);

  const countSql = `SELECT _channel, message_state, COUNT(*) as cnt FROM (${union.fragment}) t GROUP BY _channel, message_state`;
  const oldestSql = `SELECT create_date, _channel FROM (${union.fragment}) t ORDER BY create_date ASC LIMIT 1`;

  const [countResult, oldestResult] = await Promise.all([
    prisma.$queryRawUnsafe<{ _channel: string; message_state: number; cnt: bigint }[]>(countSql, ...union.params),
    prisma.$queryRawUnsafe<{ create_date: Date; _channel: string }[]>(oldestSql, ...union.params),
  ]);

  const byChannel: Record<string, { pending: number; processing: number; total: number }> = {};
  let totalPending = 0;
  let totalProcessing = 0;

  for (const row of countResult) {
    if (!byChannel[row._channel]) byChannel[row._channel] = { pending: 0, processing: 0, total: 0 };
    const cnt = Number(row.cnt);
    if (row.message_state === 0) {
      byChannel[row._channel].pending += cnt;
      totalPending += cnt;
    } else {
      byChannel[row._channel].processing += cnt;
      totalProcessing += cnt;
    }
    byChannel[row._channel].total += cnt;
  }

  let staleCount = 0;
  const olderThanMinutes = input.olderThanMinutes ?? 0;
  if (olderThanMinutes > 0) {
    const threshold = new Date(Date.now() + KST_OFFSET_MS - olderThanMinutes * 60 * 1000);
    const staleWhere = buildWhereSql({ messageStateIn: [0, 1] });
    staleWhere.conditions.push('create_date < ?');
    staleWhere.values.push(threshold);
    const staleUnion = buildUnionSql(channels, 'msg_id', staleWhere);
    const staleResult = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
      `SELECT COUNT(*) as total FROM (${staleUnion.fragment}) t`,
      ...staleUnion.params,
    );
    staleCount = Number(staleResult[0].total);
  }

  const lines = [
    `대기/처리중 현황`,
    `전체: ${totalPending + totalProcessing}건 (대기: ${totalPending} / 처리중: ${totalProcessing})`,
    '',
    '채널별:',
  ];
  for (const [ch, val] of Object.entries(byChannel)) {
    lines.push(`  ${ch}: ${val.total}건 (대기: ${val.pending} / 처리중: ${val.processing})`);
  }
  if (oldestResult.length > 0) {
    lines.push('', `가장 오래된 대기 건: ${formatKst(oldestResult[0].create_date)} (${oldestResult[0]._channel})`);
  }
  if (olderThanMinutes > 0) {
    lines.push('', `${olderThanMinutes}분 이상 체류 건: ${staleCount}건${staleCount > 0 ? ' ⚠️' : ''}`);
  }
  return lines.join('\n');
}
