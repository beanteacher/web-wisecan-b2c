import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

import { messageDeliveryTimeStats } from './delivery-time-stats.service';
import { prisma } from '@/lib/prisma';

const mockQuery = prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>;

function setupDeliveryMocks({
  bucketRows = [] as { bucket: number; cnt: bigint }[],
  channelRows = [] as { _channel: string; avg_sec: number | null; max_sec: number | null; min_sec: number | null; cnt: bigint }[],
  overallRow = { avg_sec: null as number | null, max_sec: null as number | null, min_sec: null as number | null, cnt: BigInt(0) },
} = {}) {
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes('INFORMATION_SCHEMA')) {
      return Promise.resolve([{ cnt: BigInt(1) }]);
    }
    if (sql.includes('GROUP BY bucket')) {
      return Promise.resolve(bucketRows);
    }
    if (sql.includes('GROUP BY _channel')) {
      return Promise.resolve(channelRows);
    }
    // overall stats (no GROUP BY)
    return Promise.resolve([overallRow]);
  });
}

describe('messageDeliveryTimeStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('구간별 히스토그램과 채널별 통계를 반환한다', async () => {
    setupDeliveryMocks({
      bucketRows: [
        { bucket: 0, cnt: BigInt(50) },
        { bucket: 1, cnt: BigInt(30) },
        { bucket: 2, cnt: BigInt(20) },
      ],
      channelRows: [
        { _channel: 'SMS', avg_sec: 2.3, max_sec: 8, min_sec: 0, cnt: BigInt(100) },
      ],
      overallRow: { avg_sec: 2.3, max_sec: 8, min_sec: 0, cnt: BigInt(100) },
    });

    const result = await messageDeliveryTimeStats({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-01',
    });

    expect(result).toContain('[수신 소요시간 분포]');
    expect(result).toContain('■ 구간별 분포');
    expect(result).toContain('1초 이내');
    expect(result).toContain('1~5초');
    expect(result).toContain('■ 채널별 소요시간');
    expect(result).toContain('SMS');
    expect(result).toContain('2.3초');
  });

  it('수신 완료 건이 없으면 측정 대상 0건을 반환한다', async () => {
    setupDeliveryMocks({
      bucketRows: [],
      channelRows: [],
      overallRow: { avg_sec: null, max_sec: null, min_sec: null, cnt: BigInt(0) },
    });

    const result = await messageDeliveryTimeStats({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-01',
    });

    expect(result).toContain('측정 대상: 0건');
  });

  it('전체 평균/최소/최대가 포함된다', async () => {
    setupDeliveryMocks({
      bucketRows: [{ bucket: 1, cnt: BigInt(100) }],
      channelRows: [],
      overallRow: { avg_sec: 3.7, max_sec: 120, min_sec: 1, cnt: BigInt(100) },
    });

    const result = await messageDeliveryTimeStats({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-01',
    });

    expect(result).toContain('전체 평균: 3.7초');
    expect(result).toContain('최소: 1초');
    expect(result).toContain('최대: 120초');
  });

  it('7개 구간이 모두 출력된다', async () => {
    setupDeliveryMocks({
      bucketRows: [],
      channelRows: [],
      overallRow: { avg_sec: null, max_sec: null, min_sec: null, cnt: BigInt(0) },
    });

    const result = await messageDeliveryTimeStats({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-01',
    });

    expect(result).toContain('1초 이내');
    expect(result).toContain('1~5초');
    expect(result).toContain('5~10초');
    expect(result).toContain('10~30초');
    expect(result).toContain('30~60초');
    expect(result).toContain('1~5분');
    expect(result).toContain('5분 초과');
  });

  it('로그 테이블이 없으면 에러를 던진다', async () => {
    mockQuery.mockResolvedValue([{ cnt: BigInt(0) }]);

    await expect(
      messageDeliveryTimeStats({ dateFrom: '2026-03-01', dateTo: '2026-03-01' })
    ).rejects.toThrow('LOG 테이블');
  });
});
