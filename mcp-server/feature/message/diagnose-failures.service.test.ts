import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

import { messageDiagnoseFailures } from './diagnose-failures.service';
import { prisma } from '@/lib/prisma';

const mockQuery = prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>;

describe('messageDiagnoseFailures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('실패 건이 없으면 "실패 건이 없습니다" 진단을 반환한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      // 전체 카운트
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve([{ total: BigInt(0) }]);
      }
      return Promise.resolve([]);
    });

    const result = await messageDiagnoseFailures({ dateFrom: '2026-03-01', dateTo: '2026-03-01' });

    expect(result).toContain('실패: 0건');
    expect(result).toContain('분석 기간 내 실패 건이 없습니다');
  });

  it('특정 시간대에 실패가 집중되면 시간대 장애 진단을 포함한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      if (sql.includes('HOUR(create_date)')) {
        return Promise.resolve([{ h: 14, cnt: BigInt(90) }]);
      }
      if (sql.includes('result_code') && sql.includes('GROUP BY')) {
        return Promise.resolve([{ result_code: '5001', cnt: BigInt(5) }]);
      }
      if (sql.includes('result_net_id') && sql.includes('GROUP BY')) {
        return Promise.resolve([]);
      }
      // count queries
      return Promise.resolve([{ total: BigInt(100) }]);
    });

    const result = await messageDiagnoseFailures({ dateFrom: '2026-03-01', dateTo: '2026-03-01' });

    expect(result).toContain('14시');
    expect(result).toContain('일시 장애 추정');
  });

  it('특정 결과코드가 실패의 80% 이상이면 코드 집중 진단을 반환한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      if (sql.includes('HOUR(create_date)')) {
        return Promise.resolve([{ h: 9, cnt: BigInt(10) }, { h: 10, cnt: BigInt(10) }]);
      }
      if (sql.includes('result_code') && sql.includes('GROUP BY')) {
        return Promise.resolve([{ result_code: '5001', cnt: BigInt(90) }]);
      }
      if (sql.includes('result_net_id') && sql.includes('GROUP BY')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([{ total: BigInt(100) }]);
    });

    const result = await messageDiagnoseFailures({ dateFrom: '2026-03-01', dateTo: '2026-03-01' });

    expect(result).toContain('5001');
    expect(result).toContain('집중 실패');
  });

  it('특정 통신사 실패 집중 시 통신사 이슈 진단을 반환한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      if (sql.includes('HOUR(create_date)')) {
        return Promise.resolve([{ h: 9, cnt: BigInt(5) }, { h: 10, cnt: BigInt(5) }]);
      }
      if (sql.includes('result_code') && sql.includes('GROUP BY')) {
        return Promise.resolve([{ result_code: '4000', cnt: BigInt(5) }]);
      }
      if (sql.includes('result_net_id') && sql.includes('GROUP BY')) {
        return Promise.resolve([{ result_net_id: 'KT', cnt: BigInt(90) }]);
      }
      return Promise.resolve([{ total: BigInt(100) }]);
    });

    const result = await messageDiagnoseFailures({ dateFrom: '2026-03-01', dateTo: '2026-03-01' });

    expect(result).toContain('KT');
    expect(result).toContain('통신사');
  });

  it('패턴이 없으면 "특정 패턴이 감지되지 않았습니다" 진단을 반환한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      if (sql.includes('HOUR(create_date)')) {
        // 실패가 여러 시간대에 균등 분산
        return Promise.resolve([
          { h: 9, cnt: BigInt(10) },
          { h: 10, cnt: BigInt(10) },
          { h: 11, cnt: BigInt(10) },
        ]);
      }
      if (sql.includes('result_code') && sql.includes('GROUP BY')) {
        return Promise.resolve([
          { result_code: '4200', cnt: BigInt(15) },
          { result_code: '5001', cnt: BigInt(15) },
        ]);
      }
      if (sql.includes('result_net_id') && sql.includes('GROUP BY')) {
        return Promise.resolve([{ result_net_id: 'SKT', cnt: BigInt(15) }]);
      }
      return Promise.resolve([{ total: BigInt(100) }]);
    });

    const result = await messageDiagnoseFailures({ dateFrom: '2026-03-01', dateTo: '2026-03-01' });

    expect(result).toContain('특정 패턴이 감지되지 않았습니다');
  });
});
