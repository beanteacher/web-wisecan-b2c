import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

import { messageStatSummary } from './stat-summary.service';
import { prisma } from '@/lib/prisma';

const mockQuery = prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>;

describe('messageStatSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('channel groupBy로 채널별 통계를 반환한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      return Promise.resolve([
        { grp: 'SMS', message_state: 2, cnt: BigInt(100) },
        { grp: 'SMS', message_state: 3, cnt: BigInt(10) },
        { grp: 'KKO', message_state: 2, cnt: BigInt(50) },
      ]);
    });

    const result = await messageStatSummary({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-01',
      groupBy: 'channel',
    });

    expect(result).toContain('발송 통계 요약 (groupBy: channel)');
    expect(result).toContain('SMS');
    expect(result).toContain('KKO');
    expect(result).toContain('160건');
    expect(result).toContain('성공률');
  });

  it('hour groupBy로 시간대별 통계를 반환한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      return Promise.resolve([
        { grp: 9, message_state: 2, cnt: BigInt(200) },
        { grp: 10, message_state: 3, cnt: BigInt(5) },
      ]);
    });

    const result = await messageStatSummary({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-01',
      groupBy: 'hour',
    });

    expect(result).toContain('groupBy: hour');
    expect(result).toContain('9시');
    expect(result).toContain('10시');
  });

  it('결과가 없으면 전체 0건 통계를 반환한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      return Promise.resolve([]);
    });

    const result = await messageStatSummary({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-01',
    });

    expect(result).toContain('전체: 0건');
    expect(result).toContain('성공률: 0%');
  });

  it('성공률이 올바르게 계산된다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      return Promise.resolve([
        { grp: 'SMS', message_state: 2, cnt: BigInt(90) },
        { grp: 'SMS', message_state: 3, cnt: BigInt(10) },
      ]);
    });

    const result = await messageStatSummary({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-01',
    });

    expect(result).toContain('성공률: 90%');
  });

  it('로그 테이블이 없으면 에러를 던진다', async () => {
    mockQuery.mockResolvedValue([{ cnt: BigInt(0) }]);

    await expect(
      messageStatSummary({ dateFrom: '2026-03-01', dateTo: '2026-03-01' })
    ).rejects.toThrow('LOG 테이블');
  });
});
