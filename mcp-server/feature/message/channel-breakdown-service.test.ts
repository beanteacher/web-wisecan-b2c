import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

import { messageChannelBreakdown } from './channel-breakdown-service';
import { prisma } from '@/lib/prisma';

const mockQuery = prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>;

describe('messageChannelBreakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('채널 > 세부유형 계층 표를 반환한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      return Promise.resolve([
        { _channel: 'SMS', msg_sub_type: 'SMS', message_state: 2, cnt: BigInt(500) },
        { _channel: 'MMS', msg_sub_type: 'LMS', message_state: 2, cnt: BigInt(200) },
        { _channel: 'MMS', msg_sub_type: 'MMS', message_state: 3, cnt: BigInt(30) },
        { _channel: 'KKO', msg_sub_type: 'KAT', message_state: 2, cnt: BigInt(100) },
      ]);
    });

    const result = await messageChannelBreakdown({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-01',
    });

    expect(result).toContain('[채널별 세부유형 분해]');
    expect(result).toContain('SMS');
    expect(result).toContain('MMS');
    expect(result).toContain('KKO');
    expect(result).toContain('LMS');
    expect(result).toContain('KAT');
    expect(result).toContain('830건');
  });

  it('데이터가 없으면 전체 0건을 반환한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      return Promise.resolve([]);
    });

    const result = await messageChannelBreakdown({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-01',
    });

    expect(result).toContain('전체: 0건');
    expect(result).toContain('성공률: 0%');
  });

  it('소계 행과 세부유형 행이 모두 포함된다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      return Promise.resolve([
        { _channel: 'KKO', msg_sub_type: 'KAT', message_state: 2, cnt: BigInt(80) },
        { _channel: 'KKO', msg_sub_type: 'KAI', message_state: 3, cnt: BigInt(20) },
      ]);
    });

    const result = await messageChannelBreakdown({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-01',
    });

    expect(result).toContain('(소계)');
    expect(result).toContain('KAT');
    expect(result).toContain('KAI');
  });

  it('비중(%)이 계산되어 포함된다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      return Promise.resolve([
        { _channel: 'SMS', msg_sub_type: 'SMS', message_state: 2, cnt: BigInt(100) },
      ]);
    });

    const result = await messageChannelBreakdown({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-01',
    });

    // 100% 비중
    expect(result).toContain('100%');
  });

  it('로그 테이블이 없으면 에러를 던진다', async () => {
    mockQuery.mockResolvedValue([{ cnt: BigInt(0) }]);

    await expect(
      messageChannelBreakdown({ dateFrom: '2026-03-01', dateTo: '2026-03-01' })
    ).rejects.toThrow('LOG 테이블');
  });
});
