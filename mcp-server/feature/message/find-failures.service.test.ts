import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

import { messageFindFailures } from './find-failures.service';
import { prisma } from '@/lib/prisma';

const mockQuery = prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>;

const makeFailRow = (overrides: Record<string, unknown> = {}) => ({
  msg_id: BigInt(5001),
  msg_type: 'SMS',
  msg_sub_type: 'SMS',
  destaddr: '01099998888',
  callback: '020001234',
  send_msg: '실패 메시지',
  message_state: 3,
  result_code: '4200',
  result_net_id: 'SKT',
  result_deliver_date: null,
  request_date: new Date('2026-03-01T09:00:00Z'),
  create_date: new Date('2026-03-01T09:00:00Z'),
  user_id: null,
  group_id: null,
  _channel: 'SMS',
  ...overrides,
});

describe('messageFindFailures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('실패 건이 있으면 실패 목록과 결과코드 요약을 반환한다', async () => {
    let callCount = 0;
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      if (sql.includes('COUNT(*)') && !sql.includes('GROUP BY')) {
        return Promise.resolve([{ total: BigInt(2) }]);
      }
      if (sql.includes('GROUP BY result_code')) {
        return Promise.resolve([
          { result_code: '4200', cnt: BigInt(2) },
        ]);
      }
      return Promise.resolve([makeFailRow(), makeFailRow({ msg_id: BigInt(5002) })]);
    });

    const result = await messageFindFailures({ dateFrom: '2026-03-01', dateTo: '2026-03-01' });

    expect(result).toContain('실패 건: 2건');
    expect(result).toContain('결과코드별 요약');
    expect(result).toContain('4200');
  });

  it('실패 건이 없으면 "실패 건이 없습니다" 메시지를 반환한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      if (sql.includes('COUNT(*)') && !sql.includes('GROUP BY')) {
        return Promise.resolve([{ total: BigInt(0) }]);
      }
      if (sql.includes('GROUP BY result_code')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const result = await messageFindFailures({ dateFrom: '2026-03-01', dateTo: '2026-03-01' });

    expect(result).toBe('실패 건이 없습니다.');
  });

  it('조회 가능한 로그 테이블이 없으면 에러를 던진다', async () => {
    mockQuery.mockResolvedValue([{ cnt: BigInt(0) }]);

    await expect(
      messageFindFailures({ dateFrom: '2026-03-01', dateTo: '2026-03-01' })
    ).rejects.toThrow('LOG 테이블');
  });

  it('resultCode 필터를 적용하면 해당 코드의 실패 건만 조회한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      if (sql.includes('COUNT(*)') && !sql.includes('GROUP BY')) {
        return Promise.resolve([{ total: BigInt(1) }]);
      }
      if (sql.includes('GROUP BY result_code')) {
        return Promise.resolve([{ result_code: '5001', cnt: BigInt(1) }]);
      }
      return Promise.resolve([makeFailRow({ result_code: '5001' })]);
    });

    const result = await messageFindFailures({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-01',
      resultCode: '5001',
    });

    expect(result).toContain('1건');
    expect(result).toContain('5001');
  });

  it('결과 행에 채널, msgId, 결과코드가 포함된다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      if (sql.includes('COUNT(*)') && !sql.includes('GROUP BY')) {
        return Promise.resolve([{ total: BigInt(1) }]);
      }
      if (sql.includes('GROUP BY result_code')) {
        return Promise.resolve([{ result_code: '4200', cnt: BigInt(1) }]);
      }
      return Promise.resolve([makeFailRow()]);
    });

    const result = await messageFindFailures({ dateFrom: '2026-03-01', dateTo: '2026-03-01' });

    expect(result).toContain('[SMS]');
    expect(result).toContain('5001');
    expect(result).toContain('4200');
  });
});
