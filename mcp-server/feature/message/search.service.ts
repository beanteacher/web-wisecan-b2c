import {
  prisma, KST_OFFSET_MS, parseDateFilter, todayStartKst,
  resolveChannelFilter, buildWhereSql, COMMON_SELECT,
  RawTranRow, rawToSearchRow, resolveLogTables, buildLogUnionSql,
  stateLabel,
} from './shared';
import { MessageDto } from './dto';

export type MessageSearchInput = MessageDto.MessageSearchInput;

export async function messageSearch(input: MessageSearchInput): Promise<string> {
  const page = Math.max(1, input.page ?? 1);
  const size = Math.min(100, Math.max(1, input.size ?? 20));
  const offset = (page - 1) * size;

  const { channels, subTypeFilter } = resolveChannelFilter(input.msgType);
  const dateFrom = parseDateFilter(input.dateFrom) ?? todayStartKst();
  const dateTo = parseDateFilter(input.dateTo) ?? new Date(Date.now() + KST_OFFSET_MS);
  const logTables = await resolveLogTables(channels, dateFrom, dateTo);
  const where = buildWhereSql({
    dateFrom,
    dateTo,
    destaddr: input.destaddr,
    messageState: input.messageState,
    userId: input.userId,
    groupId: input.groupId ? parseInt(input.groupId, 10) : undefined,
    subTypeFilter,
  });

  const union = buildLogUnionSql(logTables, COMMON_SELECT, where);
  const dataSql = `${union.fragment} ORDER BY create_date DESC LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) as total FROM (${union.fragment}) t`;

  const [rows, countResult] = await Promise.all([
    prisma.$queryRawUnsafe<RawTranRow[]>(dataSql, ...union.params, size, offset),
    prisma.$queryRawUnsafe<{ total: bigint }[]>(countSql, ...union.params),
  ]);

  const total = Number(countResult[0].total);
  const items = rows.map(rawToSearchRow);
  const totalPages = Math.ceil(total / size);

  if (items.length === 0) return `검색 결과가 없습니다. (전체 ${total}건)`;

  const header = `검색 결과: ${total}건 (${page}/${totalPages} 페이지)`;
  const lines = items.map(r =>
    `[${r.channel}] msg_id:${r.msgId} | ${r.destaddr} | ${stateLabel(r.messageState)} | ${r.resultCode ?? '-'} | ${r.createDate}`
  );
  return [header, '---', ...lines].join('\n');
}
