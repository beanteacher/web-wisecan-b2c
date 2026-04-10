import { describe, it, expect, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlink, stat } from 'fs/promises';
import sharp from 'sharp';
import { generateImage } from './generate-image.service';

// ── generateImage (통합) ──

const generated: string[] = [];

afterEach(async () => {
  for (const p of generated.splice(0)) {
    await unlink(p).catch(() => {});
  }
});

describe('generateImage', () => {
  it('기본 옵션으로 PNG 이미지를 생성하고 올바른 크기를 반환한다', async () => {
    const result = await generateImage({ width: 200, height: 100 });
    generated.push(result.outputPath);

    expect(result.outputPath).toMatch(/\.png$/);
    expect(result.sizeBytes).toBeGreaterThan(0);

    const meta = await sharp(result.outputPath).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(100);
    expect(meta.format).toBe('png');
  });

  it('format jpeg 로 JPEG 이미지를 생성한다', async () => {
    const result = await generateImage({ width: 300, height: 200, format: 'jpeg' });
    generated.push(result.outputPath);

    expect(result.outputPath).toMatch(/\.jpeg$/);
    expect(result.sizeBytes).toBeGreaterThan(0);

    const meta = await sharp(result.outputPath).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(300);
    expect(meta.height).toBe(200);
  });

  it('format webp 로 WebP 이미지를 생성한다', async () => {
    const result = await generateImage({ width: 150, height: 150, format: 'webp' });
    generated.push(result.outputPath);

    expect(result.outputPath).toMatch(/\.webp$/);
    expect(result.sizeBytes).toBeGreaterThan(0);

    const meta = await sharp(result.outputPath).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(150);
    expect(meta.height).toBe(150);
  });

  it('background 색상을 지정하면 해당 색상으로 배경이 설정된다', async () => {
    const outPath = join(tmpdir(), `bg-test-${Date.now()}.png`);
    const result = await generateImage({ width: 100, height: 100, background: '#FF0000', outputPath: outPath });
    generated.push(result.outputPath);

    expect(result.sizeBytes).toBeGreaterThan(0);

    // 픽셀 채널 값으로 빨간 배경 확인
    const { data } = await sharp(result.outputPath).raw().toBuffer({ resolveWithObject: true });
    // 첫 번째 픽셀 (R, G, B 순)
    expect(data[0]).toBeGreaterThan(200); // R 채널 높음
    expect(data[1]).toBeLessThan(50);     // G 채널 낮음
    expect(data[2]).toBeLessThan(50);     // B 채널 낮음
  });

  it('text 옵션을 지정하면 기본 텍스트 대신 커스텀 텍스트가 사용된다 (파일 생성 확인)', async () => {
    const outPath = join(tmpdir(), `text-test-${Date.now()}.png`);
    const result = await generateImage({ width: 200, height: 100, text: 'Hello World', outputPath: outPath });
    generated.push(result.outputPath);

    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.outputPath).toBe(outPath);

    const fileInfo = await stat(outPath);
    expect(fileInfo.size).toBeGreaterThan(0);
  });

  it('outputPath 를 지정하면 해당 경로에 파일이 생성된다', async () => {
    const outPath = join(tmpdir(), `custom-output-${Date.now()}.png`);
    const result = await generateImage({ width: 100, height: 100, outputPath: outPath });
    generated.push(result.outputPath);

    expect(result.outputPath).toBe(outPath);

    const fileInfo = await stat(outPath);
    expect(fileInfo.size).toBe(result.sizeBytes);
  });

  it('text 를 지정하지 않으면 기본 텍스트가 "width x height" 형태로 설정된다 (파일 정상 생성)', async () => {
    // 기본 label은 `${width} × ${height}` — SVG 포함 여부는 파일 크기로 간접 확인
    const result = await generateImage({ width: 320, height: 240 });
    generated.push(result.outputPath);

    expect(result.sizeBytes).toBeGreaterThan(0);
    const meta = await sharp(result.outputPath).metadata();
    expect(meta.width).toBe(320);
    expect(meta.height).toBe(240);
  });

  it('width 가 0 이면 에러를 던진다', async () => {
    await expect(generateImage({ width: 0, height: 100 })).rejects.toThrow('1~8192');
  });

  it('height 가 0 이면 에러를 던진다', async () => {
    await expect(generateImage({ width: 100, height: 0 })).rejects.toThrow('1~8192');
  });

  it('width 가 8192 초과이면 에러를 던진다', async () => {
    await expect(generateImage({ width: 8193, height: 100 })).rejects.toThrow('1~8192');
  });

  it('height 가 8192 초과이면 에러를 던진다', async () => {
    await expect(generateImage({ width: 100, height: 8193 })).rejects.toThrow('1~8192');
  });

  it('width 와 height 가 최솟값 1 이면 정상 생성된다', async () => {
    const result = await generateImage({ width: 1, height: 1 });
    generated.push(result.outputPath);

    expect(result.sizeBytes).toBeGreaterThan(0);
    const meta = await sharp(result.outputPath).metadata();
    expect(meta.width).toBe(1);
    expect(meta.height).toBe(1);
  });

  it('width 와 height 가 최댓값 8192 이면 정상 생성된다', async () => {
    const result = await generateImage({ width: 8192, height: 8192 });
    generated.push(result.outputPath);

    expect(result.sizeBytes).toBeGreaterThan(0);
    const meta = await sharp(result.outputPath).metadata();
    expect(meta.width).toBe(8192);
    expect(meta.height).toBe(8192);
  }, 30000);
});
