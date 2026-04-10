import {
  prisma, toKstNow, parseDateFilter, todayStartKst,
  VALID_MSG_TYPES, MsgType, TABLE_NAMES, buildWhereSql,
} from './shared';
import { MessageDto } from './dto';

export type MessageRetryInput = MessageDto.MessageRetryInput;

const MAX_RETRY_COUNT = 3;

export async function messageRetry(input: MessageRetryInput): Promise<string> {
  if (!input.msgIds?.length && !input.resultCode) {
    throw new Error('msgIds 또는 resultCode 중 하나는 필수입니다.');
  }

  const maxCount = Math.min(input.maxCount ?? 100, 1000);
  const kstNow = toKstNow();
  const channels: MsgType[] = [...VALID_MSG_TYPES];
  let totalRetried = 0;
  const retriedIds: string[] = [];
  const warnings: string[] = [];

  if (input.msgIds?.length) {
    const ids = input.msgIds.map(id => {
      if (!/^\d+$/.test(id.trim())) throw new Error(`유효하지 않은 msgId: ${id}`);
      return BigInt(id.trim());
    });

    for (const ch of channels) {
      const table = TABLE_NAMES[ch];
      const placeholders = ids.map(() => '?').join(', ');
      const findSql = `SELECT msg_id, retry_count FROM ${table} WHERE msg_id IN (${placeholders}) AND message_state = 3`;
      const found = await prisma.$queryRawUnsafe<{ msg_id: bigint; retry_count: number | null }[]>(findSql, ...ids);

      if (!found.length) continue;

      const retryableIds: bigint[] = [];
      for (const row of found) {
        if ((row.retry_count ?? 0) >= MAX_RETRY_COUNT) {
          warnings.push(`msgId ${row.msg_id} (${ch}): 재시도 횟수 상한(${MAX_RETRY_COUNT}회) 초과`);
        } else {
          retryableIds.push(row.msg_id);
        }
      }

      if (retryableIds.length) {
        const ph = retryableIds.map(() => '?').join(', ');
        const updateSql = `UPDATE ${table} SET message_state = 0, retry_count = COALESCE(retry_count, 0) + 1, update_date = ? WHERE msg_id IN (${ph})`;
        const affected = await prisma.$executeRawUnsafe(updateSql, kstNow, ...retryableIds);
        totalRetried += affected;
        retriedIds.push(...retryableIds.map(id => id.toString()));
      }
    }
  } else {
    const dateFrom = parseDateFilter(input.dateFrom) ?? todayStartKst();
    const dateTo = parseDateFilter(input.dateTo);
    const where = buildWhereSql({ dateFrom, dateTo, messageState: 3, resultCode: input.resultCode });
    where.conditions.push(`COALESCE(retry_count, 0) < ?`);
    where.values.push(MAX_RETRY_COUNT);

    for (const ch of channels) {
      const table = TABLE_NAMES[ch];
      const whereClause = where.conditions.length ? ' WHERE ' + where.conditions.join(' AND ') : '';

      const remaining = maxCount - totalRetried;
      if (remaining <= 0) break;

      const findSql = `SELECT msg_id FROM ${table}${whereClause} LIMIT ?`;
      const found = await prisma.$queryRawUnsafe<{ msg_id: bigint }[]>(findSql, ...where.values, remaining);

      if (!found.length) continue;

      const targetIds = found.map(r => r.msg_id);
      const ph = targetIds.map(() => '?').join(', ');
      const updateSql = `UPDATE ${table} SET message_state = 0, retry_count = COALESCE(retry_count, 0) + 1, update_date = ? WHERE msg_id IN (${ph})`;
      const affected = await prisma.$executeRawUnsafe(updateSql, kstNow, ...targetIds);
      totalRetried += affected;
      retriedIds.push(...targetIds.map(id => id.toString()));
    }
  }

  const lines = [`재발송 처리 완료: ${totalRetried}건`];
  if (retriedIds.length > 0 && retriedIds.length <= 20) {
    lines.push(`대상 msgId: ${retriedIds.join(', ')}`);
  }
  if (warnings.length > 0) {
    lines.push('', '경고:', ...warnings.map(w => `  ${w}`));
  }
  return lines.join('\n');
}
