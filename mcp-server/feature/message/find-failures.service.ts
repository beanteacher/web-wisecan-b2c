import {
  prisma, KST_OFFSET_MS, parseDateFilter, todayStartKst,
  resolveChannelFilter, buildWhereSql, COMMON_SELECT,
  RawTranRow, rawToSearchRow, resolveLogTables, buildLogUnionSql,
} from './shared';
import { MessageDto } from './dto';

export type MessageFindFailuresInput = MessageDto.MessageFindFailuresInput;

export async function messageFindFailures(input: MessageFindFailuresInput): Promise<string> {
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
    messageState: 3,
    resultCode: input.resultCode,
    subTypeFilter,
  });

  const union = buildLogUnionSql(logTables, COMMON_SELECT, where);
  const summaryUnion = buildLogUnionSql(logTables, 'result_code', where);
  const dataSql = `${union.fragment} ORDER BY create_date DESC LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) as total FROM (${union.fragment}) t`;

  const [rows, countResult, summaryResult] = await Promise.all([
    prisma.$queryRawUnsafe<RawTranRow[]>(dataSql, ...union.params, size, offset),
    prisma.$queryRawUnsafe<{ total: bigint }[]>(countSql, ...union.params),
    prisma.$queryRawUnsafe<{ result_code: string | null; cnt: bigint }[]>(
      `SELECT result_code, COUNT(*) as cnt FROM (${summaryUnion.fragment}) t GROUP BY result_code ORDER BY cnt DESC LIMIT 10`,
      ...summaryUnion.params,
    ),
  ]);

  const total = Number(countResult[0].total);
  const items = rows.map(rawToSearchRow);
  const totalPages = Math.ceil(total / size);

  if (total === 0) return '실패 건이 없습니다.';

  const header = `실패 건: ${total}건 (${page}/${totalPages} 페이지)`;
  const summary = summaryResult.map(s => `  ${s.result_code ?? '(없음)'}: ${Number(s.cnt)}건`);
  const lines = items.map(r =>
    `[${r.channel}] msg_id:${r.msgId} | ${r.destaddr} | code:${r.resultCode ?? '-'} | ${r.createDate}`
  );
  return [header, '', '결과코드별 요약:', ...summary, '', '---', ...lines].join('\n');
}
