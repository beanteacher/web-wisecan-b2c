import {
  prisma, toKstNow, VALID_MSG_TYPES, MsgType, TABLE_NAMES,
} from './shared';
import { MessageDto } from './dto';

export type MessageCancelInput = MessageDto.MessageCancelInput;

export async function messageCancel(input: MessageCancelInput): Promise<string> {
  if (!input.msgIds?.length && !input.groupId) {
    throw new Error('msgIds 또는 groupId 중 하나는 필수입니다.');
  }

  const kstNow = toKstNow();
  const channels: MsgType[] = [...VALID_MSG_TYPES];
  let totalCancelled = 0;
  let totalNotCancellable = 0;

  if (input.msgIds?.length) {
    const ids = input.msgIds.map(id => {
      if (!/^\d+$/.test(id.trim())) throw new Error(`유효하지 않은 msgId: ${id}`);
      return BigInt(id.trim());
    });

    for (const ch of channels) {
      const table = TABLE_NAMES[ch];
      const ph = ids.map(() => '?').join(', ');

      const totalResult = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
        `SELECT COUNT(*) as cnt FROM ${table} WHERE msg_id IN (${ph})`, ...ids
      );
      const totalInTable = Number(totalResult[0].cnt);

      if (!totalInTable) continue;

      const affected = await prisma.$executeRawUnsafe(
        `UPDATE ${table} SET message_state = 4, update_date = ? WHERE msg_id IN (${ph}) AND message_state = 0`,
        kstNow, ...ids
      );
      totalCancelled += affected;
      totalNotCancellable += totalInTable - affected;
    }
  } else {
    const gid = parseInt(input.groupId!, 10);
    if (Number.isNaN(gid)) throw new Error('groupId는 정수여야 합니다.');

    for (const ch of channels) {
      const table = TABLE_NAMES[ch];

      const totalResult = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
        `SELECT COUNT(*) as cnt FROM ${table} WHERE group_id = ?`, gid
      );
      const totalInTable = Number(totalResult[0].cnt);
      if (!totalInTable) continue;

      const affected = await prisma.$executeRawUnsafe(
        `UPDATE ${table} SET message_state = 4, update_date = ? WHERE group_id = ? AND message_state = 0`,
        kstNow, gid
      );
      totalCancelled += affected;
      totalNotCancellable += totalInTable - affected;
    }
  }

  return [
    `취소 처리 완료`,
    `취소 성공: ${totalCancelled}건`,
    `취소 불가 (이미 발송): ${totalNotCancellable}건`,
  ].join('\n');
}
