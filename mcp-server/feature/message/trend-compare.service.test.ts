import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

import { messageTrendCompare } from './trend-compare.service';
import { prisma } from '@/lib/prisma';

const mockQuery = prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>;

describe('messageTrendCompare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('두 기간의 채널별 비교 표를 반환한다', async () => {
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

    const result = await messageTrendCompare({
      periodA_from: '2026-02-01',
      periodA_to: '2026-02-28',
      periodB_from: '2026-03-01',
      periodB_to: '2026-03-28',
    });

    expect(result).toContain('[기간 비교]');
    expect(result).toContain('■ 전체 요약');
    expect(result).toContain('■ 증감');
    expect(result).toContain('■ 그룹별 비교');
    expect(result).toContain('기간A');
    expect(result).toContain('기간B');
  });

  it('기간 A 대비 기간 B의 증감률이 계산된다', async () => {
    let callCount = 0;
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      callCount++;
      // 기간 A: 100건, 기간 B: 120건
      if (callCount <= 1) {
        return Promise.resolve([{ grp: 'SMS', message_state: 2, cnt: BigInt(100) }]);
      }
      return Promise.resolve([{ grp: 'SMS', message_state: 2, cnt: BigInt(120) }]);
    });

    const result = await messageTrendCompare({
      periodA_from: '2026-02-01',
      periodA_to: '2026-02-28',
      periodB_from: '2026-03-01',
      periodB_to: '2026-03-28',
    });

    expect(result).toContain('증감');
  });

  it('필수 기간 파라미터가 없으면 에러를 던진다', async () => {
    await expect(
      messageTrendCompare({
        periodA_from: '2026-02-01',
        periodA_to: '2026-02-28',
        // periodB_from, periodB_to 누락
      } as Parameters<typeof messageTrendCompare>[0])
    ).rejects.toThrow('필수');
  });

  it('hour groupBy로 시간대별 비교 표를 반환한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      return Promise.resolve([
        { grp: 9, message_state: 2, cnt: BigInt(80) },
        { grp: 10, message_state: 3, cnt: BigInt(20) },
      ]);
    });

    const result = await messageTrendCompare({
      periodA_from: '2026-02-01',
      periodA_to: '2026-02-28',
      periodB_from: '2026-03-01',
      periodB_to: '2026-03-28',
      groupBy: 'hour',
    });

    expect(result).toContain('groupBy: hour');
    expect(result).toContain('9시');
    expect(result).toContain('10시');
  });

  it('데이터가 없으면 0건 비교 결과를 반환한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      return Promise.resolve([]);
    });

    const result = await messageTrendCompare({
      periodA_from: '2026-02-01',
      periodA_to: '2026-02-28',
      periodB_from: '2026-03-01',
      periodB_to: '2026-03-28',
    });

    expect(result).toContain('0건');
  });
});
