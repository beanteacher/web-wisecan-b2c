import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

import { messageGetResult } from './get-result.service';
import { prisma } from '@/lib/prisma';

const mockQuery = prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>;

const makeLogRow = (overrides: Record<string, unknown> = {}) => ({
  msg_id: BigInt(12345),
  msg_type: 'SMS',
  msg_sub_type: 'SMS',
  destaddr: '01012345678',
  callback: '020001234',
  send_msg: '테스트 메시지',
  subject: null,
  message_state: 2,
  result_code: '1000',
  result_deliver_date: new Date('2026-03-01T10:00:00Z'),
  request_date: new Date('2026-03-01T09:55:00Z'),
  create_date: new Date('2026-03-01T09:55:00Z'),
  ...overrides,
});

describe('messageGetResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SMS 로그 테이블에서 msgId를 찾으면 발송 결과를 반환한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('MCP_AGENT_SMS_LOG')) {
        return Promise.resolve([makeLogRow()]);
      }
      return Promise.resolve([]);
    });

    const result = await messageGetResult({ msgId: '12345', date: '2026-03-01' });

    expect(result).toContain('msg_id: 12345');
    expect(result).toContain('SMS');
    expect(result).toContain('01012345678');
    expect(result).toContain('1000');
  });

  it('모든 테이블에서 msgId를 찾지 못하면 에러를 던진다', async () => {
    mockQuery.mockResolvedValue([]);

    await expect(
      messageGetResult({ msgId: '99999', date: '2026-03-01' })
    ).rejects.toThrow('99999');
  });

  it('msgId가 숫자가 아니면 에러를 던진다', async () => {
    await expect(
      messageGetResult({ msgId: 'abc', date: '2026-03-01' })
    ).rejects.toThrow('msgId');
  });

  it('date가 없으면 에러를 던진다', async () => {
    await expect(
      messageGetResult({ msgId: '12345', date: '' })
    ).rejects.toThrow('date');
  });

  it('subject가 있으면 결과에 제목이 포함된다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('MCP_AGENT_SMS_LOG')) {
        return Promise.resolve([makeLogRow({ subject: '중요 공지' })]);
      }
      return Promise.resolve([]);
    });

    const result = await messageGetResult({ msgId: '12345', date: '2026-03-01' });

    expect(result).toContain('제목: 중요 공지');
  });

  it('result_deliver_date가 null이면 "(없음)"으로 표시한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('MCP_AGENT_SMS_LOG')) {
        return Promise.resolve([makeLogRow({ result_deliver_date: null })]);
      }
      return Promise.resolve([]);
    });

    const result = await messageGetResult({ msgId: '12345', date: '2026-03-01' });

    expect(result).toContain('결과수신시간: (없음)');
  });

  it('msgType을 지정하면 해당 채널 테이블만 조회한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('MCP_AGENT_MMS_LOG')) {
        return Promise.resolve([makeLogRow({ msg_type: 'MMS', msg_sub_type: 'LMS' })]);
      }
      return Promise.resolve([]);
    });

    const result = await messageGetResult({ msgId: '12345', date: '2026-03', msgType: 'MMS' });

    expect(result).toContain('MMS');
    // SMS 테이블은 호출되지 않아야 함
    const calls = mockQuery.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls.some((sql: string) => sql.includes('MCP_AGENT_SMS_LOG'))).toBe(false);
  });

  it('잘못된 msgType이면 에러를 던진다', async () => {
    await expect(
      messageGetResult({ msgId: '12345', date: '2026-03-01', msgType: 'INVALID' })
    ).rejects.toThrow('msgType');
  });
});
