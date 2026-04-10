import { describe, it, expect } from 'vitest';

// result-code-explain은 DB를 사용하지 않으므로 prisma mock 불필요
import { messageResultCodeExplain } from './result-code-explain.service';

describe('messageResultCodeExplain', () => {
  it('알려진 결과코드 1000(성공)을 설명 반환한다', () => {
    const result = messageResultCodeExplain({ resultCode: '1000' });

    expect(result).toContain('1000');
    expect(result).toContain('성공');
    expect(result).toContain('재시도 불가');
  });

  it('재시도 가능한 코드 4000은 "(재시도 가능)" 표시한다', () => {
    const result = messageResultCodeExplain({ resultCode: '4000' });

    expect(result).toContain('4000');
    expect(result).toContain('재시도 가능');
  });

  it('알 수 없는 코드에 대해 카테고리를 추정하여 반환한다', () => {
    const result = messageResultCodeExplain({ resultCode: '9999' });

    expect(result).toContain('9999');
    expect(result).toContain('알 수 없는 결과코드');
  });

  it('5xxx 계열 알 수 없는 코드는 재시도 가능으로 추정한다', () => {
    const result = messageResultCodeExplain({ resultCode: '5999' });

    expect(result).toContain('재시도 가능');
  });

  it('resultCode 없이 호출하면 전체 코드 목록을 반환한다', () => {
    const result = messageResultCodeExplain({});

    // RESULT_CODE_MAP 전체 22개 코드가 포함되어야 함
    expect(result).toContain('1000');
    expect(result).toContain('2001');
    expect(result).toContain('5100');
    // 여러 줄이어야 함
    expect(result.split('\n').length).toBeGreaterThan(10);
  });

  it('코드 2001(수신번호 형식 오류)은 재시도 불가다', () => {
    const result = messageResultCodeExplain({ resultCode: '2001' });

    expect(result).toContain('수신번호 형식 오류');
    expect(result).toContain('재시도 불가');
  });
});
