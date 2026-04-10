import {
  prisma, KST_OFFSET_MS, toKstNow, formatKst,
  VALID_MSG_TYPES, MsgType, MSG_TYPE_SUB_TYPES, TABLE_NAMES,
} from './shared';
import { MessageDto } from './dto';

export type MessageSendInput = MessageDto.MessageSendInput;
export type MessageSendResult = MessageDto.MessageSendResult;

function ensureString(value: unknown, field: string, maxLength?: number): string {
  if (typeof value !== 'string') {
    throw new Error(`${field}는 문자열이어야 합니다.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field}는 비어 있을 수 없습니다.`);
  }
  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new Error(`${field} 길이는 ${maxLength}자를 초과할 수 없습니다.`);
  }
  return trimmed;
}

function ensureOptionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return ensureString(value, field, maxLength);
}

function normalizePhone(value: string, field: string): string {
  const normalized = value.replace(/[^0-9+]/g, '');
  if (!normalized) {
    throw new Error(`${field} 형식이 올바르지 않습니다.`);
  }
  return normalized;
}

function parseRequestDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('requestDate 형식이 올바르지 않습니다. ISO 8601 문자열을 사용하세요.');
  }
  return new Date(date.getTime() + KST_OFFSET_MS);
}

function parseGroupId(value: string | undefined): number | undefined {
  if (!value) return undefined;
  if (!/^-?\d+$/.test(value)) {
    throw new Error('groupId는 정수 문자열이어야 합니다.');
  }
  return parseInt(value, 10);
}

function countFiles(filePath: string | undefined): number {
  if (!filePath) return 0;
  return filePath.split(',').filter((p) => p.trim()).length;
}

export async function messageSend(input: MessageSendInput): Promise<MessageSendResult> {
  const msgType = input.msgType.toUpperCase() as MsgType;
  if (!VALID_MSG_TYPES.includes(msgType)) {
    throw new Error(`msgType은 ${VALID_MSG_TYPES.join(', ')} 중 하나여야 합니다.`);
  }

  const msgSubType = ensureString(input.msgSubType, 'msgSubType', 5).toUpperCase();
  const allowedSubTypes = MSG_TYPE_SUB_TYPES[msgType];
  if (!allowedSubTypes.includes(msgSubType)) {
    throw new Error(`msgType ${msgType}의 msgSubType은 ${allowedSubTypes.join(', ')} 중 하나여야 합니다.`);
  }

  const destaddr = normalizePhone(ensureString(input.destaddr, 'destaddr', 32), 'destaddr');
  const callback = normalizePhone(ensureString(input.callback, 'callback', 32), 'callback');
  const sendMsg = ensureString(input.sendMsg, 'sendMsg');

  const subject = msgType === 'SMS'
    ? undefined
    : ensureOptionalString(input.subject, 'subject', 120);

  const filePath = ensureOptionalString(input.filePath, 'filePath', 255);
  const fileCount = countFiles(filePath);

  const userId = ensureOptionalString(input.userId, 'userId', 32) ?? process.env.MCP_TRAN_DEFAULT_USER_ID;
  const kisaCode = ensureOptionalString(input.kisaCode, 'kisaCode', 20) ?? process.env.MCP_TRAN_DEFAULT_KISA_CODE;
  const billCode = ensureOptionalString(input.billCode, 'billCode', 30) ?? process.env.MCP_TRAN_DEFAULT_BILL_CODE;
  const groupId = parseGroupId(input.groupId);
  const requestDate = parseRequestDate(input.requestDate) ?? toKstNow();

  const kstNow = toKstNow();
  const table = TABLE_NAMES[msgType];
  let columns: string;
  let placeholders: string;
  let values: unknown[];

  const baseColumns = 'msg_type, msg_sub_type, destaddr, callback, send_msg, user_id, kisa_code, bill_code, group_id, request_date, create_date, update_date';
  const baseValues: unknown[] = [msgType, msgSubType, destaddr, callback, sendMsg, userId, kisaCode, billCode, groupId, requestDate, kstNow, kstNow];

  if (msgType === 'SMS') {
    columns = baseColumns;
    placeholders = baseValues.map(() => '?').join(', ');
    values = baseValues;
  } else if (msgType === 'MMS' || msgType === 'RCS') {
    columns = `${baseColumns}, subject, file_path, file_count`;
    values = [...baseValues, subject, filePath, fileCount];
    placeholders = values.map(() => '?').join(', ');
  } else {
    columns = `${baseColumns}, subject, sender_key`;
    values = [...baseValues, subject, ''];
    placeholders = values.map(() => '?').join(', ');
  }

  const insertSql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
  await prisma.$executeRawUnsafe(insertSql, ...values);

  const [inserted] = await prisma.$queryRawUnsafe<{ id: bigint }[]>('SELECT LAST_INSERT_ID() as id');
  const newMsgId = inserted.id;

  return {
    msgId: newMsgId.toString(),
    msgType,
    msgSubType,
    destaddr,
    tableName: table,
    requestDate: formatKst(requestDate),
  };
}

export function formatSendResult(result: MessageSendResult): string {
  return [
    `message_send 적재 성공`,
    `table: ${result.tableName}`,
    `msg_id: ${result.msgId}`,
    `msg_type: ${result.msgType}`,
    `msg_sub_type: ${result.msgSubType}`,
    `destaddr: ${result.destaddr}`,
    `request_date: ${result.requestDate}`,
  ].join('\n');
}
