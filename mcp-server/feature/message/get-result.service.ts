import {
  prisma, formatKst, VALID_MSG_TYPES, MsgType,
  TABLE_NAMES, LOG_TABLE_PREFIXES, stateLabel,
} from './shared';
import { MessageDto } from './dto';

export type MessageGetResultInput = MessageDto.MessageGetResultInput;

type LogQueryRow = {
  msg_id: bigint;
  msg_type: string;
  msg_sub_type: string;
  destaddr: string;
  callback: string;
  send_msg: string | null;
  subject?: string | null;
  message_state: number;
  result_code: string | null;
  result_deliver_date: Date | null;
  request_date: Date;
  create_date: Date;
};

function buildLogDateSuffixes(dateStr: string): string[] {
  const cleaned = dateStr.replace(/[^0-9]/g, '');
  const suffixes: string[] = [];
  if (cleaned.length >= 8) {
    suffixes.push(cleaned.slice(0, 8));
    suffixes.push(cleaned.slice(0, 6));
  } else if (cleaned.length >= 6) {
    suffixes.push(cleaned.slice(0, 6));
  } else {
    throw new Error(`date 형식이 올바르지 않습니다: ${dateStr} (YYYY-MM-DD 또는 YYYYMM 형식)`);
  }
  return suffixes;
}

export async function messageGetResult(input: MessageGetResultInput): Promise<string> {
  const raw = input.msgId.trim();
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error('msgId는 양의 정수 문자열이어야 합니다.');
  }
  if (!input.date) {
    throw new Error('date는 필수입니다. (발송일 YYYY-MM-DD 또는 YYYYMM)');
  }
  const id = BigInt(raw);
  const suffixes = buildLogDateSuffixes(input.date);

  let channels: MsgType[];
  if (input.msgType) {
    const upper = input.msgType.toUpperCase() as MsgType;
    if (!VALID_MSG_TYPES.includes(upper)) {
      throw new Error(`msgType은 ${VALID_MSG_TYPES.join(', ')} 중 하나여야 합니다.`);
    }
    channels = [upper];
  } else {
    channels = [...VALID_MSG_TYPES];
  }

  const candidates: { channel: MsgType; table: string }[] = [];
  for (const ch of channels) {
    for (const suffix of suffixes) {
      candidates.push({ channel: ch, table: `${LOG_TABLE_PREFIXES[ch]}_${suffix}` });
    }
  }

  const results = await Promise.all(
    candidates.map(({ channel, table }) =>
      prisma.$queryRawUnsafe<LogQueryRow[]>(
        `SELECT msg_id, msg_type, msg_sub_type, destaddr, callback, send_msg, subject, message_state, result_code, result_deliver_date, request_date, create_date FROM ${table} WHERE msg_id = ?`,
        id,
      )
        .then(rows => rows.length > 0 ? { channel, table, record: rows[0] } : null)
        .catch(() => null)
    )
  );

  for (const result of results) {
    if (result) {
      const r = result.record;
      const lines = [
        `[${result.channel}] 발송 결과 조회`,
        `table: ${result.table}`,
        `msg_id: ${r.msg_id.toString()}`,
        `msg_type: ${r.msg_type} / ${r.msg_sub_type}`,
        `수신번호: ${r.destaddr}`,
        `발신번호: ${r.callback}`,
        `메시지: ${r.send_msg ?? '(없음)'}`,
      ];
      if (r.subject) lines.push(`제목: ${r.subject}`);
      lines.push(
        `발송상태: ${stateLabel(r.message_state)}`,
        `결과코드: ${r.result_code ?? '(없음)'}`,
        `결과수신시간: ${r.result_deliver_date ? formatKst(r.result_deliver_date) : '(없음)'}`,
        `등록일시: ${formatKst(r.create_date)}`,
        `발송요청일시: ${formatKst(r.request_date)}`,
      );
      return lines.join('\n');
    }
  }

  const triedTables = candidates.map(c => c.table).join(', ');
  throw new Error(`msgId ${raw}에 해당하는 메시지를 찾을 수 없습니다. (탐색 테이블: ${triedTables})`);
}
