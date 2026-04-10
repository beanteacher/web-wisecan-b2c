import { describe, it, expect } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, readFile, unlink } from 'fs/promises';
import { mdToDocx } from './md-to-docx.service';

// ── mdToDocx (통합) ──

describe('mdToDocx', () => {
  const tmpMd = join(tmpdir(), `test-${Date.now()}.md`);
  const tmpDocx = join(tmpdir(), `test-${Date.now()}.docx`);

  it('목차 링크 → 내부 하이퍼링크, 헤딩 → 북마크', async () => {
    const md = [
      '## 목차',
      '',
      '1. [서론](#1-서론)',
      '',
      '---',
      '',
      '## 1. 서론',
      '',
      '본문입니다.',
    ].join('\n');

    await writeFile(tmpMd, md, 'utf-8');
    const result = await mdToDocx(tmpMd, tmpDocx);

    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.outputPath).toBe(tmpDocx);

    // DOCX는 ZIP → word/document.xml 내에 북마크/하이퍼링크가 포함되어야 함
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await readFile(tmpDocx));
    const docXml = await zip.file('word/document.xml')!.async('string');
    expect(docXml).toContain('1-서론'); // bookmark name or anchor

    await unlink(tmpMd).catch(() => {});
    await unlink(tmpDocx).catch(() => {});
  });

  it('테이블이 포함된 DOCX 생성', async () => {
    const md = '| A | B |\n| --- | --- |\n| 1 | 2 |';
    const mdPath = join(tmpdir(), `tbl-${Date.now()}.md`);
    const docxPath = join(tmpdir(), `tbl-${Date.now()}.docx`);

    await writeFile(mdPath, md, 'utf-8');
    const result = await mdToDocx(mdPath, docxPath);
    expect(result.sizeBytes).toBeGreaterThan(0);

    await unlink(mdPath).catch(() => {});
    await unlink(docxPath).catch(() => {});
  });

  it('코드 블록이 포함된 DOCX 생성', async () => {
    const md = '```\nconst x = 1;\n```';
    const mdPath = join(tmpdir(), `code-${Date.now()}.md`);
    const docxPath = join(tmpdir(), `code-${Date.now()}.docx`);

    await writeFile(mdPath, md, 'utf-8');
    const result = await mdToDocx(mdPath, docxPath);
    expect(result.sizeBytes).toBeGreaterThan(0);

    await unlink(mdPath).catch(() => {});
    await unlink(docxPath).catch(() => {});
  });
});
