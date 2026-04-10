import { prisma } from '@/lib/prisma';
import { MessageDto } from './dto';

export { prisma };

export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Prisma는 Date의 UTC 값을 그대로 DB에 저장하므로, UTC+9 시프트된 Date를 만들어 KST가 저장되게 한다. */
export function toKstNow(): Date {
  return new Date(Date.now() + KST_OFFSET_MS);
}

/** Date의 UTC 값이 이미 KST이므로 getUTC* 메서드를 사용한다. */
export function formatKst(date: Date): string {
  const y = date.getUTCFullYear();
  const M = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const m = String(date.getUTCMinutes()).padStart(2, '0');
  const s = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}-${M}-${d}T${h}:${m}:${s}+09:00`;
}

export const VALID_MSG_TYPES = ['SMS', 'MMS', 'KKO', 'RCS'] as const;
export type MsgType = MessageDto.MsgType;

export const MSG_TYPE_SUB_TYPES: Record<MsgType, string[]> = {
  SMS: ['SMS'],
  MMS: ['LMS', 'MMS'],
  KKO: ['KAT', 'KAI', 'KFT', 'KFI', 'KFP'],
  RCS: ['RSM', 'RLM', 'RTT'],
};

export const TABLE_NAMES: Record<MsgType, string> = {
  SMS: process.env.MCP_TABLE_SMS ?? 'MCP_AGENT_SMS_TRAN',
  MMS: process.env.MCP_TABLE_MMS ?? 'MCP_AGENT_MMS_TRAN',
  KKO: process.env.MCP_TABLE_KKO ?? 'MCP_AGENT_KKO_TRAN',
  RCS: process.env.MCP_TABLE_RCS ?? 'MCP_AGENT_RCS_TRAN',
};

export const LOG_TABLE_PREFIXES: Record<MsgType, string> = {
  SMS: process.env.MCP_LOG_TABLE_SMS ?? 'MCP_AGENT_SMS_LOG',
  MMS: process.env.MCP_LOG_TABLE_MMS ?? 'MCP_AGENT_MMS_LOG',
  KKO: process.env.MCP_LOG_TABLE_KKO ?? 'MCP_AGENT_KKO_LOG',
  RCS: process.env.MCP_LOG_TABLE_RCS ?? 'MCP_AGENT_RCS_LOG',
};

// =========================================
// Date helpers
// =========================================

export function parseDateFilter(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(value + 'T00:00:00Z');
  }
  if (/[+-]\d{2}:\d{2}$/.test(value) || value.endsWith('Z')) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new Error(`날짜 형식이 올바르지 않습니다: ${value}`);
    return new Date(d.getTime() + KST_OFFSET_MS);
  }
  const d = new Date(value + (value.includes('T') ? 'Z' : 'T00:00:00Z'));
  if (Number.isNaN(d.getTime())) throw new Error(`날짜 형식이 올바르지 않습니다: ${value}`);
  return d;
}

export function todayStartKst(): Date {
  const now = new Date(Date.now() + KST_OFFSET_MS);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function yesterdayStartKst(): Date {
  const today = todayStartKst();
  return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

// =========================================
// Channel / filter helpers
// =========================================

export function resolveChannelFilter(input?: string): { channels: MsgType[]; subTypeFilter?: string } {
  if (!input) return { channels: [...VALID_MSG_TYPES] };
  const upper = input.toUpperCase();
  if (VALID_MSG_TYPES.includes(upper as MsgType)) return { channels: [upper as MsgType] };
  for (const [type, subs] of Object.entries(MSG_TYPE_SUB_TYPES)) {
    if (subs.includes(upper)) return { channels: [type as MsgType], subTypeFilter: upper };
  }
  throw new Error(`알 수 없는 msgType: ${input}`);
}

// =========================================
// SQL builder helpers
// =========================================

export type WhereParams = MessageDto.WhereParams;

export function buildWhereSql(params: WhereParams): { conditions: string[]; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (params.dateFrom) { conditions.push('create_date >= ?'); values.push(params.dateFrom); }
  if (params.dateTo) { conditions.push('create_date <= ?'); values.push(params.dateTo); }
  if (params.destaddr) { conditions.push('destaddr LIKE ?'); values.push(`%${params.destaddr}%`); }
  if (params.messageState !== undefined) { conditions.push('message_state = ?'); values.push(params.messageState); }
  if (params.messageStateIn?.length) {
    conditions.push(`message_state IN (${params.messageStateIn.map(() => '?').join(', ')})`);
    values.push(...params.messageStateIn);
  }
  if (params.userId) { conditions.push('user_id = ?'); values.push(params.userId); }
  if (params.groupId !== undefined) { conditions.push('group_id = ?'); values.push(params.groupId); }
  if (params.resultCode) { conditions.push('result_code = ?'); values.push(params.resultCode); }
  if (params.subTypeFilter) { conditions.push('msg_sub_type = ?'); values.push(params.subTypeFilter); }
  return { conditions, values };
}

export const COMMON_SELECT = 'msg_id, msg_type, msg_sub_type, destaddr, callback, send_msg, message_state, result_code, result_net_id, result_deliver_date, request_date, create_date, user_id, group_id';

export type RawTranRow = MessageDto.RawTranRow;

export function rawToSearchRow(r: RawTranRow) {
  return {
    msgId: r.msg_id.toString(),
    channel: r._channel,
    msgType: r.msg_type,
    msgSubType: r.msg_sub_type,
    destaddr: r.destaddr,
    callback: r.callback,
    sendMsg: r.send_msg,
    messageState: r.message_state,
    resultCode: r.result_code,
    resultNetId: r.result_net_id,
    resultDeliverDate: r.result_deliver_date ? formatKst(r.result_deliver_date) : null,
    requestDate: formatKst(r.request_date),
    createDate: formatKst(r.create_date),
    userId: r.user_id,
    groupId: r.group_id,
    tableName: TABLE_NAMES[r._channel as MsgType],
  };
}

export function buildUnionSql(channels: MsgType[], select: string, where: { conditions: string[]; values: unknown[] }): { fragment: string; params: unknown[] } {
  const whereClause = where.conditions.length ? ' WHERE ' + where.conditions.join(' AND ') : '';
  const unions = channels.map(ch =>
    `SELECT ${select}, '${ch}' as _channel FROM ${TABLE_NAMES[ch]}${whereClause}`
  );
  const params: unknown[] = [];
  for (let i = 0; i < channels.length; i++) params.push(...where.values);
  return { fragment: unions.join(' UNION ALL '), params };
}

// =========================================
// LOG table helpers
// =========================================

/** YYYYMM suffix 목록을 dateFrom~dateTo 범위에서 생성한다. */
export function buildYearMonthSuffixes(dateFrom: Date, dateTo: Date): string[] {
  const suffixes: string[] = [];
  const cur = new Date(Date.UTC(dateFrom.getUTCFullYear(), dateFrom.getUTCMonth(), 1));
  const end = new Date(Date.UTC(dateTo.getUTCFullYear(), dateTo.getUTCMonth(), 1));
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
    suffixes.push(`${y}${m}`);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return suffixes;
}

/** YYYYMMDD suffix 목록을 dateFrom~dateTo 범위에서 생성한다. */
export function buildYearMonthDaySuffixes(dateFrom: Date, dateTo: Date): string[] {
  const suffixes: string[] = [];
  const cur = new Date(Date.UTC(dateFrom.getUTCFullYear(), dateFrom.getUTCMonth(), dateFrom.getUTCDate()));
  const end = new Date(Date.UTC(dateTo.getUTCFullYear(), dateTo.getUTCMonth(), dateTo.getUTCDate()));
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cur.getUTCDate()).padStart(2, '0');
    suffixes.push(`${y}${m}${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return suffixes;
}

/**
 * dateFrom~dateTo 범위에 해당하는 존재하는 LOG 테이블 목록을 반환한다.
 * YYYYMM 테이블이 없으면 YYYYMMDD로 재시도한다.
 */
export async function resolveLogTables(
  channels: MsgType[],
  dateFrom: Date,
  dateTo: Date,
): Promise<{ table: string; channel: MsgType }[]> {
  const mmSuffixes = buildYearMonthSuffixes(dateFrom, dateTo);
  const candidates = channels.flatMap(ch =>
    mmSuffixes.map(s => ({ table: `${LOG_TABLE_PREFIXES[ch]}_${s}`, channel: ch }))
  );

  const existenceChecks = await Promise.all(
    candidates.map(c =>
      prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
        `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = ?`,
        c.table,
      )
        .then(rows => Number(rows[0].cnt) > 0 ? c : null)
        .catch(() => null)
    )
  );

  const found = existenceChecks.filter((c): c is { table: string; channel: MsgType } => c !== null);
  if (found.length > 0) return found;

  // YYYYMM 테이블이 없으면 YYYYMMDD로 재시도
  const ddSuffixes = buildYearMonthDaySuffixes(dateFrom, dateTo);
  const ddCandidates = channels.flatMap(ch =>
    ddSuffixes.map(s => ({ table: `${LOG_TABLE_PREFIXES[ch]}_${s}`, channel: ch }))
  );

  const ddChecks = await Promise.all(
    ddCandidates.map(c =>
      prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
        `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = ?`,
        c.table,
      )
        .then(rows => Number(rows[0].cnt) > 0 ? c : null)
        .catch(() => null)
    )
  );

  return ddChecks.filter((c): c is { table: string; channel: MsgType } => c !== null);
}

/**
 * `buildUnionSql`과 동일하지만 `{ table, channel }[]`를 받는다.
 * tables가 비어있으면 에러를 던진다.
 */
export function buildLogUnionSql(
  tables: { table: string; channel: MsgType }[],
  select: string,
  where: { conditions: string[]; values: unknown[] },
): { fragment: string; params: unknown[] } {
  if (tables.length === 0) {
    throw new Error('조회 가능한 LOG 테이블이 없습니다.');
  }
  const whereClause = where.conditions.length ? ' WHERE ' + where.conditions.join(' AND ') : '';
  const unions = tables.map(({ table, channel }) =>
    `SELECT ${select}, '${channel}' as _channel FROM ${table}${whereClause}`
  );
  const params: unknown[] = [];
  for (let i = 0; i < tables.length; i++) params.push(...where.values);
  return { fragment: unions.join(' UNION ALL '), params };
}

// =========================================
// Result code map (shared by explain, diagnose, daily report)
// =========================================

export function stateLabel(s: number): string {
  if (s === 0) return '대기';
  if (s === 1) return '발송중';
  if (s === 2) return '발송완료(성공)';
  if (s === 3) return '발송완료(실패)';
  if (s === 4) return '취소';
  return `상태코드(${s})`;
}

export const RESULT_CODE_MAP: Record<string, { description: string; category: string; retryable: boolean }> = {
  '1000': { description: '성공', category: '성공', retryable: false },
  '2000': { description: '형식 오류 (일반)', category: '형식오류', retryable: false },
  '2001': { description: '수신번호 형식 오류', category: '형식오류', retryable: false },
  '2002': { description: '발신번호 형식 오류', category: '형식오류', retryable: false },
  '2003': { description: '메시지 본문 누락', category: '형식오류', retryable: false },
  '2004': { description: '메시지 길이 초과', category: '형식오류', retryable: false },
  '3000': { description: '인증 오류 (일반)', category: '인증오류', retryable: false },
  '3001': { description: '발신번호 미등록', category: '인증오류', retryable: false },
  '3002': { description: '사용자 권한 없음', category: '인증오류', retryable: false },
  '3003': { description: '발송 한도 초과', category: '인증오류', retryable: true },
  '4000': { description: '수신 오류 (일반)', category: '수신오류', retryable: true },
  '4100': { description: '착신 거부 / 수신 차단', category: '수신오류', retryable: false },
  '4200': { description: '결번 / 존재하지 않는 번호', category: '수신오류', retryable: false },
  '4300': { description: '단말기 전원 꺼짐', category: '수신오류', retryable: true },
  '4400': { description: '음영지역 / 서비스 불가', category: '수신오류', retryable: true },
  '4500': { description: '메시지함 가득 참', category: '수신오류', retryable: true },
  '4600': { description: '단말기 메시지 수신 불가', category: '수신오류', retryable: true },
  '4700': { description: '스팸 차단', category: '수신오류', retryable: false },
  '5000': { description: '시스템 오류 (일반)', category: '시스템오류', retryable: true },
  '5001': { description: '릴레이 서버 연결 실패', category: '시스템오류', retryable: true },
  '5002': { description: '통신사 연동 실패', category: '시스템오류', retryable: true },
  '5003': { description: '타임아웃', category: '시스템오류', retryable: true },
  '5100': { description: '내부 처리 오류', category: '시스템오류', retryable: true },
};
