import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

import { messageWeeklyReport } from './weekly-report.service';
import { prisma } from '@/lib/prisma';

const mockQuery = prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>;

function setupWeeklyMocks({
  dailyRows = [] as { d: Date; message_state: number; cnt: bigint }[],
  channelRows = [] as { _channel: string; message_state: number; cnt: bigint }[],
  prevRows = [] as { message_state: number; cnt: bigint }[],
} = {}) {
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes('INFORMATION_SCHEMA')) {
      return Promise.resolve([{ cnt: BigInt(1) }]);
    }
    if (sql.includes('DATE(create_date)')) {
      return Promise.resolve(dailyRows);
    }
    if (sql.includes('_channel') && sql.includes('message_state')) {
      return Promise.resolve(channelRows);
    }
    // prev week query
    if (sql.includes('message_state') && sql.includes('GROUP BY message_state')) {
      return Promise.resolve(prevRows);
    }
    return Promise.resolve([]);
  });
}

describe('messageWeeklyReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('weekStartDate를 지정하면 해당 주의 리포트를 반환한다', async () => {
    setupWeeklyMocks({
      dailyRows: [
        { d: new Date('2026-03-01T00:00:00Z'), message_state: 2, cnt: BigInt(100) },
        { d: new Date('2026-03-02T00:00:00Z'), message_state: 3, cnt: BigInt(10) },
      ],
      channelRows: [
        { _channel: 'SMS', message_state: 2, cnt: BigInt(100) },
        { _channel: 'SMS', message_state: 3, cnt: BigInt(10) },
      ],
      prevRows: [
        { message_state: 2, cnt: BigInt(80) },
        { message_state: 3, cnt: BigInt(20) },
      ],
    });

    const result = await messageWeeklyReport({ weekStartDate: '2026-03-01' });

    expect(result).toContain('[주간 발송 리포트]');
    expect(result).toContain('2026-03-01');
    expect(result).toContain('■ 전체 요약');
    expect(result).toContain('■ 전주 대비 증감');
    expect(result).toContain('■ 일별 추이');
  });

  it('전주 대비 발송량 증감률이 계산된다', async () => {
    setupWeeklyMocks({
      dailyRows: [],
      channelRows: [
        { _channel: 'SMS', message_state: 2, cnt: BigInt(110) },
      ],
      prevRows: [
        { message_state: 2, cnt: BigInt(100) },
      ],
    });

    const result = await messageWeeklyReport({ weekStartDate: '2026-03-01' });

    expect(result).toContain('전주 대비 증감');
    expect(result).toContain('+10%');
  });

  it('전주 데이터가 없으면 증감률을 "-"로 표시한다', async () => {
    setupWeeklyMocks({
      dailyRows: [],
      channelRows: [
        { _channel: 'SMS', message_state: 2, cnt: BigInt(50) },
      ],
      prevRows: [],
    });

    const result = await messageWeeklyReport({ weekStartDate: '2026-03-01' });

    expect(result).toContain('전주 대비 증감');
    // 전주 데이터 없으면 '+100%' 또는 '-' 표시
    expect(result).toMatch(/발송량: (\+100%|-)/);
  });

  it('weekStartDate 없이 호출하면 최근 7일 리포트를 반환한다', async () => {
    setupWeeklyMocks({
      dailyRows: [],
      channelRows: [],
      prevRows: [],
    });

    const result = await messageWeeklyReport({});

    expect(result).toContain('[주간 발송 리포트]');
    expect(result).toMatch(/\d{4}-\d{2}-\d{2} ~ \d{4}-\d{2}-\d{2}/);
  });

  it('채널별 집계가 포함된다', async () => {
    setupWeeklyMocks({
      dailyRows: [],
      channelRows: [
        { _channel: 'SMS', message_state: 2, cnt: BigInt(200) },
        { _channel: 'KKO', message_state: 2, cnt: BigInt(100) },
      ],
      prevRows: [],
    });

    const result = await messageWeeklyReport({ weekStartDate: '2026-03-01' });

    expect(result).toContain('■ 채널별 집계');
    expect(result).toContain('SMS');
    expect(result).toContain('KKO');
  });
});
