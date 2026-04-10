import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

import { messageCheckPending } from './check-pending.service';
import { prisma } from '@/lib/prisma';

const mockQuery = prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>;

describe('messageCheckPending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('대기/처리중 건이 있으면 채널별 집계를 반환한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('GROUP BY') && sql.includes('_channel') && sql.includes('message_state')) {
        return Promise.resolve([
          { _channel: 'SMS', message_state: 0, cnt: BigInt(10) },
          { _channel: 'SMS', message_state: 1, cnt: BigInt(3) },
          { _channel: 'KKO', message_state: 0, cnt: BigInt(5) },
        ]);
      }
      if (sql.includes('ORDER BY create_date ASC LIMIT 1')) {
        return Promise.resolve([
          { create_date: new Date('2026-03-01T08:00:00Z'), _channel: 'SMS' },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await messageCheckPending({});

    expect(result).toContain('대기/처리중 현황');
    expect(result).toContain('SMS');
    expect(result).toContain('KKO');
    expect(result).toContain('18건');
  });

  it('대기/처리중 건이 없으면 전체 0건을 반환한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('GROUP BY')) {
        return Promise.resolve([]);
      }
      if (sql.includes('ORDER BY create_date ASC LIMIT 1')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const result = await messageCheckPending({});

    expect(result).toContain('0건');
  });

  it('olderThanMinutes를 지정하면 체류 건 수가 포함된다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('GROUP BY') && sql.includes('message_state')) {
        return Promise.resolve([
          { _channel: 'SMS', message_state: 0, cnt: BigInt(20) },
        ]);
      }
      if (sql.includes('ORDER BY create_date ASC LIMIT 1')) {
        return Promise.resolve([
          { create_date: new Date('2026-03-01T07:00:00Z'), _channel: 'SMS' },
        ]);
      }
      // stale count query
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve([{ total: BigInt(5) }]);
      }
      return Promise.resolve([]);
    });

    const result = await messageCheckPending({ olderThanMinutes: 30 });

    expect(result).toContain('30분 이상 체류 건');
    expect(result).toContain('5건');
  });

  it('가장 오래된 대기 건의 채널과 날짜가 포함된다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('GROUP BY')) {
        return Promise.resolve([
          { _channel: 'MMS', message_state: 0, cnt: BigInt(2) },
        ]);
      }
      if (sql.includes('ORDER BY create_date ASC LIMIT 1')) {
        return Promise.resolve([
          { create_date: new Date('2026-03-01T06:00:00Z'), _channel: 'MMS' },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await messageCheckPending({});

    expect(result).toContain('가장 오래된 대기 건');
    expect(result).toContain('MMS');
  });
});
