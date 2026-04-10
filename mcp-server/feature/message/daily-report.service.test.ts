import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

import { messageDailyReport } from './daily-report.service';
import { prisma } from '@/lib/prisma';

const mockQuery = prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>;

function setupDailyMocks({
  channelRows = [] as { _channel: string; message_state: number; cnt: bigint }[],
  failCodeRows = [] as { result_code: string | null; cnt: bigint }[],
  hourlyRows = [] as { h: number; cnt: bigint }[],
  avgSec = null as number | null,
} = {}) {
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes('INFORMATION_SCHEMA')) {
      return Promise.resolve([{ cnt: BigInt(1) }]);
    }
    if (sql.includes('AVG(TIMESTAMPDIFF')) {
      return Promise.resolve([{ avg_sec: avgSec }]);
    }
    if (sql.includes('HOUR(create_date)')) {
      return Promise.resolve(hourlyRows);
    }
    if (sql.includes('result_code') && sql.includes('GROUP BY')) {
      return Promise.resolve(failCodeRows);
    }
    if (sql.includes('_channel') && sql.includes('message_state')) {
      return Promise.resolve(channelRows);
    }
    return Promise.resolve([]);
  });
}

describe('messageDailyReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('날짜를 지정하면 해당 날짜의 일간 리포트를 반환한다', async () => {
    setupDailyMocks({
      channelRows: [
        { _channel: 'SMS', message_state: 2, cnt: BigInt(500) },
        { _channel: 'SMS', message_state: 3, cnt: BigInt(50) },
        { _channel: 'KKO', message_state: 2, cnt: BigInt(200) },
      ],
      failCodeRows: [{ result_code: '4200', cnt: BigInt(30) }],
      hourlyRows: [{ h: 9, cnt: BigInt(300) }, { h: 10, cnt: BigInt(250) }],
      avgSec: 3.5,
    });

    const result = await messageDailyReport({ date: '2026-03-01' });

    expect(result).toContain('[2026-03-01] 일간 발송 리포트');
    expect(result).toContain('750건');
    expect(result).toContain('SMS');
    expect(result).toContain('KKO');
    expect(result).toContain('Top 실패코드');
    expect(result).toContain('4200');
  });

  it('발송 건이 없어도 0건 리포트를 반환한다', async () => {
    setupDailyMocks({
      channelRows: [],
      failCodeRows: [],
      hourlyRows: [],
      avgSec: null,
    });

    const result = await messageDailyReport({ date: '2026-03-01' });

    expect(result).toContain('전체: 0건');
    expect(result).toContain('성공률: 0%');
    expect(result).toContain('데이터 없음');
  });

  it('date 없이 호출하면 어제 날짜 리포트를 반환한다', async () => {
    setupDailyMocks({
      channelRows: [{ _channel: 'SMS', message_state: 2, cnt: BigInt(100) }],
      hourlyRows: [],
      failCodeRows: [],
      avgSec: null,
    });

    const result = await messageDailyReport({});

    // 어제 날짜 형식 YYYY-MM-DD가 포함되어야 함
    expect(result).toMatch(/\[\d{4}-\d{2}-\d{2}\] 일간 발송 리포트/);
  });

  it('성공률이 올바르게 계산된다', async () => {
    setupDailyMocks({
      channelRows: [
        { _channel: 'SMS', message_state: 2, cnt: BigInt(80) },
        { _channel: 'SMS', message_state: 3, cnt: BigInt(20) },
      ],
      failCodeRows: [],
      hourlyRows: [],
      avgSec: null,
    });

    const result = await messageDailyReport({ date: '2026-03-01' });

    expect(result).toContain('성공률: 80%');
  });

  it('평균 수신 소요시간이 있으면 초 단위로 표시한다', async () => {
    setupDailyMocks({
      channelRows: [{ _channel: 'SMS', message_state: 2, cnt: BigInt(100) }],
      failCodeRows: [],
      hourlyRows: [],
      avgSec: 12.5,
    });

    const result = await messageDailyReport({ date: '2026-03-01' });

    expect(result).toContain('12.5초');
  });
});
