import PDFDocument from 'pdfkit';
import { readFile, stat as fsStat } from 'fs/promises';
import { createWriteStream } from 'fs';
import { resolve } from 'path';
import { MALGUN, MALGUN_B, CONSOLA, ConvertResult, parseMd, stripAll } from './shared';

export async function mdToPdf(sourcePath: string, outputPath?: string): Promise<ConvertResult> {
  const src = resolve(sourcePath);
  const out = outputPath ? resolve(outputPath) : src.replace(/\.md$/i, '.pdf');
  const md = await readFile(src, 'utf-8');
  const blocks = parseMd(md);

  const doc = new PDFDocument({ margin: 72, size: 'A4' });
  doc.registerFont('malgun', MALGUN);
  doc.registerFont('malgun-bold', MALGUN_B);
  doc.registerFont('consolas', CONSOLA);

  const pageW = doc.page.width;
  const margin = 72;
  const contentW = pageW - 2 * margin;

  // 한글 앵커 → ASCII ID 매핑 (pdfkit goTo 호환성)
  const anchorMap = new Map<string, string>();
  let hIdx = 0;
  for (const b of blocks) {
    if (b.type === 'heading') anchorMap.set(b.bid, `h${++hIdx}`);
  }

  for (const block of blocks) {
    if (doc.y > doc.page.height - 100) doc.addPage();
    doc.x = margin; // 매 블록마다 x 위치 초기화

    switch (block.type) {
      case 'heading': {
        const sizes = [0, 18, 14, 12, 11];
        doc.moveDown(block.level <= 2 ? 0.8 : 0.5);
        doc.addNamedDestination(anchorMap.get(block.bid) || block.bid);
        doc.font('malgun-bold').fontSize(sizes[block.level]).fillColor('#1E1E1E');
        doc.text(block.text, { width: contentW });
        if (block.level === 2) {
          const ly = doc.y + 2;
          doc.moveTo(margin, ly).lineTo(pageW - margin, ly)
            .strokeColor('#CCCCCC').lineWidth(0.5).stroke();
          doc.moveDown(0.3);
        }
        doc.moveDown(0.2);
        break;
      }
      case 'paragraph':
        doc.font('malgun').fontSize(10).fillColor('#323232');
        doc.text(stripAll(block.text), { width: contentW });
        doc.moveDown(0.3);
        break;
      case 'bullet': {
        const ind = 8 + block.level * 8;
        const markers = ['\u2022', '-', '\u25E6'];
        doc.font('malgun').fontSize(10).fillColor('#323232');
        doc.text(`${markers[Math.min(block.level, 2)]} ${stripAll(block.text)}`, margin + ind, undefined, { width: contentW - ind });
        doc.moveDown(0.1);
        break;
      }
      case 'numbered': {
        const linkMatch = block.text.match(/^\[([^\]]+)\]\(#([^)]+)\)$/);
        if (linkMatch) {
          const destId = anchorMap.get(linkMatch[2]) || linkMatch[2];
          doc.font('malgun').fontSize(10).fillColor('#005AB5');
          doc.text(`${block.num}. ${linkMatch[1]}`, margin + 8, undefined, { width: contentW - 8, goTo: destId, underline: true });
        } else {
          doc.font('malgun').fontSize(10).fillColor('#323232');
          doc.text(`${block.num}. ${stripAll(block.text)}`, margin + 8, undefined, { width: contentW - 8 });
        }
        doc.moveDown(0.1);
        break;
      }
      case 'blockquote': {
        doc.font('malgun').fontSize(10).fillColor('#505050');
        // 페이지 넘김 시 바가 깨지지 않도록 텍스트 높이 사전 계산
        const qHeight = doc.heightOfString(stripAll(block.text), { width: contentW - 15 });
        if (doc.y + qHeight + 10 > doc.page.height - 72) doc.addPage();
        const yBefore = doc.y;
        doc.text(stripAll(block.text), margin + 15, undefined, { width: contentW - 15 });
        const yAfter = doc.y;
        // 같은 페이지에서만 세로 바 그리기
        if (yAfter > yBefore) {
          doc.save();
          doc.moveTo(margin + 10, yBefore).lineTo(margin + 10, yAfter)
            .strokeColor('#B0B0B0').lineWidth(2).stroke();
          doc.restore();
        }
        doc.moveDown(0.3);
        break;
      }
      case 'code': {
        doc.font('consolas').fontSize(9);
        const codeH = doc.heightOfString(block.text, { width: contentW - 10 }) + 10;
        const codeY = doc.y;
        if (codeY + codeH > doc.page.height - 72) { doc.addPage(); }
        const cy = doc.y;
        doc.save();
        doc.rect(margin, cy, contentW, codeH).fill('#F0F0F0');
        doc.restore();
        doc.fillColor('#3C3C3C');
        doc.text(block.text, margin + 5, cy + 5, { width: contentW - 10 });
        doc.moveDown(0.3);
        break;
      }
      case 'table': {
        const colW = contentW / block.headers.length;
        const pad = 4;
        let y = doc.y;

        // Helper: calculate row height based on content
        const rowHeight = (cells: string[], font: string, fontSize: number): number => {
          doc.font(font).fontSize(fontSize);
          let maxH = 0;
          for (const cell of cells) {
            const h = doc.heightOfString(stripAll(cell), { width: colW - pad * 2 });
            if (h > maxH) maxH = h;
          }
          return maxH + pad * 2;
        };

        // Header
        const hdrH = Math.max(rowHeight(block.headers, 'malgun-bold', 9), 20);
        if (y + hdrH > doc.page.height - 72) { doc.addPage(); y = 72; }
        doc.save();
        block.headers.forEach((_, ci) => {
          doc.rect(margin + ci * colW, y, colW, hdrH).fillAndStroke('#373F51', '#CCCCCC');
        });
        doc.restore();
        doc.font('malgun-bold').fontSize(9).fillColor('#FFFFFF');
        block.headers.forEach((h, ci) => {
          doc.text(h, margin + ci * colW + pad, y + pad, { width: colW - pad * 2, align: 'center' });
        });
        y += hdrH;

        // Rows
        block.rows.forEach((row, ri) => {
          const rH = Math.max(rowHeight(row, 'malgun', 9), 18);
          if (y + rH > doc.page.height - 72) { doc.addPage(); y = 72; }
          const bg = ri % 2 === 1 ? '#F8F9FA' : '#FFFFFF';
          doc.save();
          row.forEach((_, ci) => {
            doc.rect(margin + ci * colW, y, colW, rH).fillAndStroke(bg, '#CCCCCC');
          });
          doc.restore();
          doc.font('malgun').fontSize(9).fillColor('#323232');
          row.forEach((cell, ci) => {
            doc.text(stripAll(cell), margin + ci * colW + pad, y + pad, { width: colW - pad * 2 });
          });
          y += rH;
        });

        doc.x = margin;
        doc.y = y + 5;
        break;
      }
    }
  }

  return new Promise<ConvertResult>((res, rej) => {
    const stream = createWriteStream(out);
    doc.pipe(stream);
    doc.end();
    stream.on('finish', async () => {
      const info = await fsStat(out);
      res({ outputPath: out, sizeBytes: info.size });
    });
    stream.on('error', rej);
  });
}
