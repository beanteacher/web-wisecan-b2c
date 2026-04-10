// ── Constants ──

export const FONT = '맑은 고딕';
export const CODE = 'Consolas';
export const CM25 = 1418; // 2.5cm in twips

export const FONT_DIR = 'C:/Windows/Fonts';
export const MALGUN = `${FONT_DIR}/malgun.ttf`;
export const MALGUN_B = `${FONT_DIR}/malgunbd.ttf`;
export const CONSOLA = `${FONT_DIR}/consola.ttf`;

// ── Types ──

import { FileDto } from './dto';
export type ConvertResult = FileDto.ConvertResult;
export type MdBlock = FileDto.MdBlock;

// ── Formatters ──

export function formatConvertResult(result: ConvertResult): string {
  const sizeKB = (result.sizeBytes / 1024).toFixed(1);
  return `변환 완료\n- 출력: ${result.outputPath}\n- 크기: ${sizeKB} KB`;
}

// ── Strip helpers ──

export function stripLinks(t: string) { return t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); }
export function stripBold(t: string) { return t.replace(/\*\*(.+?)\*\*/g, '$1'); }
export function stripCode(t: string) { return t.replace(/`(.+?)`/g, '$1'); }
export function stripAll(t: string) { return stripCode(stripBold(stripLinks(t))); }

// ── Shared Parser ──

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[*`[\]()]+/g, '')
    .replace(/[^\w\s가-힣-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseTableLines(lines: string[], start: number) {
  const hs = lines[start].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  let sep = start + 1;
  if (sep < lines.length && /^\s*\|[\s\-:|]+\|/.test(lines[sep])) sep++;
  const rows: string[][] = [];
  let i = sep;
  while (i < lines.length) {
    const l = lines[i].trim();
    if (!l.startsWith('|')) break;
    const r = l.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    while (r.length < hs.length) r.push('');
    rows.push(r.slice(0, hs.length));
    i++;
  }
  return { headers: hs, rows, endIdx: i };
}

export function parseMd(text: string): MdBlock[] {
  const lines = text.split('\n');
  const blocks: MdBlock[] = [];
  let i = 0, inCode = false;
  const codeBuf: string[] = [];

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      if (inCode) {
        blocks.push({ type: 'code', text: codeBuf.join('\n') });
        codeBuf.length = 0;
        inCode = false;
      } else inCode = true;
      i++; continue;
    }
    if (inCode) { codeBuf.push(line); i++; continue; }

    const s = line.trim();
    if (!s) { i++; continue; }
    if (/^-{3,}$/.test(s) || /^\*{3,}$/.test(s)) { i++; continue; }

    const hm = s.match(/^(#{1,4})\s*(.+)/);
    if (hm) {
      const lv = hm[1].length as 1 | 2 | 3 | 4;
      const t = stripLinks(hm[2].trim());
      blocks.push({ type: 'heading', level: lv, text: t, bid: slugify(t) });
      i++; continue;
    }

    if (s.startsWith('|') && i + 1 < lines.length && /^\s*\|[\s\-:|]+\|/.test(lines[i + 1])) {
      const { headers, rows, endIdx } = parseTableLines(lines, i);
      blocks.push({ type: 'table', headers: headers.map(stripBold), rows });
      i = endIdx; continue;
    }

    if (s.startsWith('>')) {
      let qt = s.replace(/^>+/, '').trim();
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('>')) {
        i++;
        const nl = lines[i].trim().replace(/^>+/, '').trim();
        if (nl) qt += '\n' + nl;
      }
      blocks.push({ type: 'blockquote', text: qt });
      i++; continue;
    }

    const nm = s.match(/^(\d+)\.\s+(.+)/);
    if (nm) { blocks.push({ type: 'numbered', num: nm[1], text: nm[2] }); i++; continue; }

    const bm = line.match(/^(\s*)([-*])\s+(.+)/);
    if (bm) {
      const indent = bm[1].length;
      const lv = indent < 2 ? 0 : indent < 4 ? 1 : Math.min(Math.floor(indent / 2), 3);
      blocks.push({ type: 'bullet', text: bm[3], level: lv });
      i++; continue;
    }

    blocks.push({ type: 'paragraph', text: s });
    i++;
  }
  return blocks;
}
