import { describe, it, expect } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, readFile, unlink } from 'fs/promises';
import { mdToPdf } from './md-to-pdf.service';

// ── mdToPdf (통합) ──

describe('mdToPdf', () => {
  it('목차 링크 + 헤딩 포함 PDF 생성', async () => {
    const md = [
      '## 목차',
      '',
      '1. [서론](#1-서론)',
      '',
      '## 1. 서론',
      '',
      '본문입니다.',
    ].join('\n');

    const mdPath = join(tmpdir(), `pdf-${Date.now()}.md`);
    const pdfPath = join(tmpdir(), `pdf-${Date.now()}.pdf`);

    await writeFile(mdPath, md, 'utf-8');
    const result = await mdToPdf(mdPath, pdfPath);

    expect(result.sizeBytes).toBeGreaterThan(0);

    // PDF 시그니처 확인
    const buf = await readFile(pdfPath);
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');

    await unlink(mdPath).catch(() => {});
    await unlink(pdfPath).catch(() => {});
  });

  it('테이블 포함 PDF 생성', async () => {
    const md = '| 헤더1 | 헤더2 |\n| --- | --- |\n| A | B |';
    const mdPath = join(tmpdir(), `ptbl-${Date.now()}.md`);
    const pdfPath = join(tmpdir(), `ptbl-${Date.now()}.pdf`);

    await writeFile(mdPath, md, 'utf-8');
    const result = await mdToPdf(mdPath, pdfPath);
    expect(result.sizeBytes).toBeGreaterThan(0);

    await unlink(mdPath).catch(() => {});
    await unlink(pdfPath).catch(() => {});
  });

  it('빈 MD → PDF 생성 (크래시 없음)', async () => {
    const mdPath = join(tmpdir(), `empty-${Date.now()}.md`);
    const pdfPath = join(tmpdir(), `empty-${Date.now()}.pdf`);

    await writeFile(mdPath, '', 'utf-8');
    const result = await mdToPdf(mdPath, pdfPath);
    expect(result.sizeBytes).toBeGreaterThan(0);

    await unlink(mdPath).catch(() => {});
    await unlink(pdfPath).catch(() => {});
  });
});
