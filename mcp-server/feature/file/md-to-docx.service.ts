import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  BookmarkStart, BookmarkEnd, InternalHyperlink,
  WidthType, AlignmentType, BorderStyle, ShadingType, UnderlineType,
} from 'docx';
import { readFile, writeFile, stat as fsStat } from 'fs/promises';
import { resolve } from 'path';
import { FONT, CODE, CM25, ConvertResult, MdBlock, parseMd } from './shared';

// ── DOCX-specific types ──

type DocxChild = TextRun | InternalHyperlink;

// ── DOCX inline renderers ──

function boldCodeRuns(text: string, size: number, color: string): TextRun[] {
  const out: TextRun[] = [];
  const re = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  let last = 0, m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT, size: size * 2, color }));
    if (m[2]) out.push(new TextRun({ text: m[2], font: FONT, size: size * 2, color, bold: true }));
    else if (m[3]) out.push(new TextRun({ text: m[3], font: CODE, size: Math.max(size - 1, 8) * 2, color: 'B43232' }));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT, size: size * 2, color }));
  return out;
}

function inlineDocx(text: string, size: number, color: string): DocxChild[] {
  const out: DocxChild[] = [];
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0, m: RegExpExecArray | null;

  while ((m = linkRe.exec(text)) !== null) {
    if (m.index > last) out.push(...boldCodeRuns(text.slice(last, m.index), size, color));
    const [, lt, href] = m;
    if (href.startsWith('#')) {
      out.push(new InternalHyperlink({
        anchor: href.slice(1),
        children: [new TextRun({ text: lt, font: FONT, size: size * 2, color: '005AB5', underline: { type: UnderlineType.SINGLE } })],
      }));
    } else {
      out.push(...boldCodeRuns(lt, size, color));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...boldCodeRuns(text.slice(last), size, color));
  return out;
}

function blockToDocx(block: MdBlock, bid: { n: number }): (Paragraph | Table)[] {
  switch (block.type) {
    case 'heading': {
      const sz = [0, 18, 14, 12, 11][block.level];
      const cl = ['', '1E1E1E', '282828', '323232', '3C3C3C'][block.level];
      bid.n++;
      const children: (BookmarkStart | TextRun | BookmarkEnd)[] = [
        new BookmarkStart(block.bid, bid.n),
        new TextRun({ text: block.text, font: FONT, size: sz * 2, color: cl, bold: true }),
        new BookmarkEnd(bid.n),
      ];
      const opts: Record<string, unknown> = {
        children,
        spacing: { after: block.level <= 2 ? 120 : 80 },
      };
      if (block.level >= 2) (opts.spacing as Record<string, number>).before = block.level === 2 ? 320 : block.level === 3 ? 200 : 160;
      if (block.level === 2) opts.border = { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC', space: 1 } };
      return [new Paragraph(opts as ConstructorParameters<typeof Paragraph>[0])];
    }
    case 'paragraph':
      return [new Paragraph({ children: inlineDocx(block.text, 10, '323232'), spacing: { after: 80 } })];
    case 'bullet': {
      const indent = 0.8 + block.level * 0.8;
      const markers = ['\u2022', '-', '\u25E6'];
      return [new Paragraph({
        children: [
          new TextRun({ text: `${markers[Math.min(block.level, 2)]} `, font: FONT, size: 20, color: '323232' }),
          ...inlineDocx(block.text, 10, '323232'),
        ],
        indent: { left: Math.round(indent * 567), hanging: Math.round(0.4 * 567) },
        spacing: { after: 40 },
      })];
    }
    case 'numbered':
      return [new Paragraph({
        children: [
          new TextRun({ text: `${block.num}. `, font: FONT, size: 20, color: '323232' }),
          ...inlineDocx(block.text, 10, '323232'),
        ],
        indent: { left: Math.round(0.8 * 567), hanging: Math.round(0.4 * 567) },
        spacing: { after: 40 },
      })];
    case 'blockquote':
      return [new Paragraph({
        children: inlineDocx(block.text, 10, '505050'),
        border: { left: { style: BorderStyle.SINGLE, size: 3, color: 'B0B0B0', space: 8 } },
        shading: { fill: 'F5F5F5', type: ShadingType.CLEAR, color: 'auto' },
        spacing: { after: 120 },
      })];
    case 'code':
      return [new Paragraph({
        children: [new TextRun({ text: block.text, font: CODE, size: 18, color: '3C3C3C' })],
        shading: { fill: 'F0F0F0', type: ShadingType.CLEAR, color: 'auto' },
        spacing: { after: 120 },
      })];
    case 'table': {
      const bdr = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
      const hdrRow = new TableRow({
        children: block.headers.map(h => new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: h, font: FONT, size: 18, color: 'FFFFFF', bold: true })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
          })],
          shading: { fill: '373F51', type: ShadingType.CLEAR, color: 'auto' },
        })),
      });
      const dataRows = block.rows.map((row, ri) => new TableRow({
        children: row.map(cell => new TableCell({
          children: [new Paragraph({
            children: inlineDocx(cell, 9, '323232'),
            spacing: { before: 60, after: 60 },
          })],
          shading: { fill: ri % 2 === 1 ? 'F8F9FA' : 'FFFFFF', type: ShadingType.CLEAR, color: 'auto' },
        })),
      }));
      const colCount = block.headers.length;
      const contentTwips = 9070; // A4 - 2.5cm margins
      const colW = Array(colCount).fill(Math.floor(contentTwips / colCount));
      return [
        new Table({
          rows: [hdrRow, ...dataRows],
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: colW,
          borders: { top: bdr, bottom: bdr, left: bdr, right: bdr, insideHorizontal: bdr, insideVertical: bdr },
        }),
        new Paragraph({ spacing: { after: 80 } }),
      ];
    }
  }
}

export async function mdToDocx(sourcePath: string, outputPath?: string): Promise<ConvertResult> {
  const src = resolve(sourcePath);
  const out = outputPath ? resolve(outputPath) : src.replace(/\.md$/i, '.docx');
  const md = await readFile(src, 'utf-8');
  const blocks = parseMd(md);
  const bid = { n: 0 };
  const children = blocks.flatMap(b => blockToDocx(b, bid));

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: CM25, bottom: CM25, left: CM25, right: CM25 } } },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  await writeFile(out, buffer);
  const info = await fsStat(out);
  return { outputPath: out, sizeBytes: info.size };
}
