import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

import { messageSearch } from './search.service';
import { prisma } from '@/lib/prisma';

const mockQuery = prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>;

const makeRawRow = (overrides: Record<string, unknown> = {}) => ({
  msg_id: BigInt(1001),
  msg_type: 'SMS',
  msg_sub_type: 'SMS',
  destaddr: '01012345678',
  callback: '020001234',
  send_msg: '테스트',
  message_state: 2,
  result_code: '1000',
  result_net_id: null,
  result_deliver_date: new Date('2026-03-01T10:00:00Z'),
  request_date: new Date('2026-03-01T09:55:00Z'),
  create_date: new Date('2026-03-01T09:55:00Z'),
  user_id: null,
  group_id: null,
  _channel: 'SMS',
  ...overrides,
});

describe('messageSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('검색 결과가 있으면 헤더와 메시지 목록을 반환한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      // INFORMATION_SCHEMA 테이블 존재 확인 → 테이블 있음
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      // count 쿼리
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve([{ total: BigInt(3) }]);
      }
      // data 쿼리
      return Promise.resolve([
        makeRawRow({ msg_id: BigInt(1001) }),
        makeRawRow({ msg_id: BigInt(1002) }),
        makeRawRow({ msg_id: BigInt(1003) }),
      ]);
    });

    const result = await messageSearch({ dateFrom: '2026-03-01', dateTo: '2026-03-01' });

    expect(result).toContain('3건');
    expect(result).toContain('1001');
  });

  it('검색 결과가 없으면 "검색 결과가 없습니다" 메시지를 반환한다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve([{ total: BigInt(0) }]);
      }
      return Promise.resolve([]);
    });

    const result = await messageSearch({ dateFrom: '2026-03-01', dateTo: '2026-03-01' });

    expect(result).toContain('검색 결과가 없습니다');
  });

  it('page/size가 결과 헤더에 반영된다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve([{ total: BigInt(50) }]);
      }
      return Promise.resolve([makeRawRow()]);
    });

    const result = await messageSearch({ dateFrom: '2026-03-01', dateTo: '2026-03-01', page: 2, size: 10 });

    expect(result).toContain('50건');
    expect(result).toContain('2/');
  });

  it('조회 가능한 로그 테이블이 없으면 에러를 던진다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(0) }]);
      }
      return Promise.resolve([]);
    });

    await expect(
      messageSearch({ dateFrom: '2026-03-01', dateTo: '2026-03-01' })
    ).rejects.toThrow('LOG 테이블');
  });

  it('결과 각 행에 채널 정보와 상태가 포함된다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INFORMATION_SCHEMA')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve([{ total: BigInt(1) }]);
      }
      return Promise.resolve([makeRawRow({ message_state: 2 })]);
    });

    const result = await messageSearch({ dateFrom: '2026-03-01', dateTo: '2026-03-01' });

    expect(result).toContain('[SMS]');
    expect(result).toContain('1000');
  });
});
