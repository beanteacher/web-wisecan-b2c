import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

import { messageRetry } from './retry.service';
import { prisma } from '@/lib/prisma';

const mockQuery = prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>;
const mockExec = prisma.$executeRawUnsafe as ReturnType<typeof vi.fn>;

describe('messageRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('msgIds로 재발송 요청하면 UPDATE 후 처리 건수를 반환한다', async () => {
    mockQuery.mockResolvedValue([
      { msg_id: BigInt(1001), retry_count: 0 },
    ]);
    mockExec.mockResolvedValue(1);

    const result = await messageRetry({ msgIds: ['1001'] });

    expect(result).toContain('재발송 처리 완료: 1건');
    expect(result).toContain('1001');
  });

  it('retry_count가 상한(3회)에 도달한 msgId는 경고를 반환한다', async () => {
    mockQuery.mockResolvedValue([
      { msg_id: BigInt(2001), retry_count: 3 },
    ]);
    mockExec.mockResolvedValue(0);

    const result = await messageRetry({ msgIds: ['2001'] });

    expect(result).toContain('경고');
    expect(result).toContain('재시도 횟수 상한');
  });

  it('resultCode 조건으로 재발송 요청하면 해당 코드 실패 건이 처리된다', async () => {
    mockQuery.mockResolvedValue([
      { msg_id: BigInt(3001) },
      { msg_id: BigInt(3002) },
    ]);
    mockExec.mockResolvedValue(2);

    const result = await messageRetry({
      resultCode: '5001',
      dateFrom: '2026-03-01',
    });

    expect(result).toContain('재발송 처리 완료: 2건');
  });

  it('msgIds도 resultCode도 없으면 에러를 던진다', async () => {
    await expect(
      messageRetry({})
    ).rejects.toThrow('msgIds 또는 resultCode');
  });

  it('유효하지 않은 msgId 형식이면 에러를 던진다', async () => {
    await expect(
      messageRetry({ msgIds: ['abc'] })
    ).rejects.toThrow('유효하지 않은 msgId');
  });

  it('대상이 없으면 0건 처리를 반환한다', async () => {
    mockQuery.mockResolvedValue([]);
    mockExec.mockResolvedValue(0);

    const result = await messageRetry({ msgIds: ['9999'] });

    expect(result).toContain('재발송 처리 완료: 0건');
  });
});
