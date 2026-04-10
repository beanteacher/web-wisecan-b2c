import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

import { messageCancel } from './cancel-service';
import { prisma } from '@/lib/prisma';

const mockQuery = prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>;
const mockExec = prisma.$executeRawUnsafe as ReturnType<typeof vi.fn>;

describe('messageCancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('msgIds로 대기 상태(0) 건을 취소하면 취소 성공 건수를 반환한다', async () => {
    // SMS 테이블에 1건 존재, 대기 상태로 취소 가능
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      return Promise.resolve([]);
    });
    mockExec.mockResolvedValue(1);

    const result = await messageCancel({ msgIds: ['1001'] });

    expect(result).toContain('취소 처리 완료');
    expect(result).toContain('취소 성공: 1건');
    expect(result).toContain('취소 불가 (이미 발송): 0건');
  });

  it('이미 발송된 건(messageState != 0)은 취소 불가 건수에 포함된다', async () => {
    // 테이블에 1건 존재하지만 UPDATE는 0건 (이미 발송)
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve([{ cnt: BigInt(1) }]);
      }
      return Promise.resolve([]);
    });
    mockExec.mockResolvedValue(0);

    const result = await messageCancel({ msgIds: ['2001'] });

    expect(result).toContain('취소 성공: 0건');
    expect(result).toContain('취소 불가 (이미 발송): 1건');
  });

  it('groupId로 취소 요청하면 해당 그룹의 대기 건이 취소된다', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve([{ cnt: BigInt(5) }]);
      }
      return Promise.resolve([]);
    });
    mockExec.mockResolvedValue(5);

    const result = await messageCancel({ groupId: '100' });

    expect(result).toContain('취소 성공: 5건');
  });

  it('msgIds도 groupId도 없으면 에러를 던진다', async () => {
    await expect(
      messageCancel({})
    ).rejects.toThrow('msgIds 또는 groupId');
  });

  it('유효하지 않은 msgId 형식이면 에러를 던진다', async () => {
    await expect(
      messageCancel({ msgIds: ['abc'] })
    ).rejects.toThrow('유효하지 않은 msgId');
  });

  it('groupId가 숫자가 아니면 에러를 던진다', async () => {
    await expect(
      messageCancel({ groupId: 'notanumber' })
    ).rejects.toThrow('정수');
  });

  it('테이블에 해당 건이 없으면 0건 취소를 반환한다', async () => {
    mockQuery.mockResolvedValue([{ cnt: BigInt(0) }]);
    mockExec.mockResolvedValue(0);

    const result = await messageCancel({ msgIds: ['9999'] });

    expect(result).toContain('취소 성공: 0건');
    expect(result).toContain('취소 불가 (이미 발송): 0건');
  });
});
