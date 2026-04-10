import { describe, it, expect } from 'vitest';
import { slugify, parseMd } from './shared';

// ── slugify ──

describe('slugify', () => {
  it('한글 헤딩', () => expect(slugify('1. 서론')).toBe('1-서론'));
  it('영문', () => expect(slugify('Hello World')).toBe('hello-world'));
  it('한영 혼합', () => expect(slugify('KVKK 법제 및 분석')).toBe('kvkk-법제-및-분석'));
  it('마크다운 문법 제거', () => expect(slugify('**bold** `code`')).toBe('bold-code'));
  it('괄호 제거', () => expect(slugify('굴삭기(건설장비) 현황')).toBe('굴삭기건설장비-현황'));
  it('중복 하이픈 정리', () => expect(slugify('a  -  b')).toBe('a-b'));
  it('빈 문자열', () => expect(slugify('')).toBe(''));
});

// ── parseMd ──

describe('parseMd', () => {
  it('헤딩 파싱', () => {
    const blocks = parseMd('# 제목\n\n## 소제목');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1, text: '제목' });
    expect(blocks[1]).toMatchObject({ type: 'heading', level: 2, text: '소제목' });
  });

  it('헤딩에 링크가 있으면 텍스트만 추출', () => {
    const blocks = parseMd('## [서론](#1-서론)');
    expect(blocks[0]).toMatchObject({ type: 'heading', text: '서론' });
  });

  it('헤딩에 bookmark ID 생성', () => {
    const blocks = parseMd('## 1. 서론');
    expect(blocks[0]).toMatchObject({ bid: '1-서론' });
  });

  it('불릿 목록 다단계', () => {
    const blocks = parseMd('- 항목1\n  - 하위항목');
    expect(blocks[0]).toMatchObject({ type: 'bullet', text: '항목1', level: 0 });
    expect(blocks[1]).toMatchObject({ type: 'bullet', text: '하위항목', level: 1 });
  });

  it('번호 목록', () => {
    const blocks = parseMd('1. 첫째\n2. 둘째');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'numbered', num: '1', text: '첫째' });
  });

  it('코드 블록', () => {
    const blocks = parseMd('```\nconst x = 1;\n```');
    expect(blocks[0]).toMatchObject({ type: 'code', text: 'const x = 1;' });
  });

  it('인용문', () => {
    const blocks = parseMd('> 인용문 테스트');
    expect(blocks[0]).toMatchObject({ type: 'blockquote', text: '인용문 테스트' });
  });

  it('테이블', () => {
    const md = '| 이름 | 값 |\n| --- | --- |\n| A | 1 |\n| B | 2 |';
    const blocks = parseMd(md);
    expect(blocks[0]).toMatchObject({
      type: 'table',
      headers: ['이름', '값'],
      rows: [['A', '1'], ['B', '2']],
    });
  });

  it('수평선 무시', () => {
    const blocks = parseMd('텍스트\n\n---\n\n다음');
    expect(blocks.every(b => b.type !== 'code')).toBe(true);
    expect(blocks).toHaveLength(2);
  });

  it('빈 입력', () => {
    expect(parseMd('')).toHaveLength(0);
  });
});
