import { mdToDocx } from '@/feature/file/md-to-docx.service';
import { mdToPdf } from '@/feature/file/md-to-pdf.service';
import { generateImage, formatGenerateImageResult } from '@/feature/file/generate-image.service';
import { formatConvertResult } from '@/feature/file/shared';
import { ToolModule } from '@/mcp/types';
import { readRequiredString, readOptionalString, readNumber } from '@/mcp/utils';

export const fileModule: ToolModule = {
  tools: [
    {
      name: 'file_fransform_md_to_docx',
      description: 'Markdown 파일을 DOCX(Word) 문서로 변환합니다. 맑은 고딕 기반 스타일이 자동 적용됩니다.',
      inputSchema: {
        type: 'object',
        properties: {
          sourcePath: { type: 'string', description: '변환할 MD 파일의 절대 경로' },
          outputPath: { type: 'string', description: '출력 DOCX 파일 경로 (미지정 시 같은 위치에 .docx 생성)' },
        },
        required: ['sourcePath'],
      },
    },
    {
      name: 'file_transform_md_to_pdf',
      description: 'Markdown 파일을 PDF 문서로 변환합니다. 맑은 고딕 기반 스타일과 목차 내부 링크가 자동 적용됩니다.',
      inputSchema: {
        type: 'object',
        properties: {
          sourcePath: { type: 'string', description: '변환할 MD 파일의 절대 경로' },
          outputPath: { type: 'string', description: '출력 PDF 파일 경로 (미지정 시 같은 위치에 .pdf 생성)' },
        },
        required: ['sourcePath'],
      },
    },
    {
      name: 'file_generate_image',
      description: '지정한 가로×세로 크기의 샘플 이미지를 생성합니다. 배경색, 텍스트, 포맷(png/jpeg/webp) 지정 가능.',
      inputSchema: {
        type: 'object',
        properties: {
          width: { type: 'number', description: '이미지 가로 픽셀 (1~8192)' },
          height: { type: 'number', description: '이미지 세로 픽셀 (1~8192)' },
          background: { type: 'string', description: '배경색 (CSS 색상값, 기본 #E0E0E0)' },
          text: { type: 'string', description: '이미지 중앙에 표시할 텍스트 (기본: "가로×세로")' },
          format: { type: 'string', enum: ['png', 'jpeg', 'webp'], description: '출력 포맷 (기본 png)' },
          outputPath: { type: 'string', description: '출력 파일 경로 (미지정 시 임시 디렉토리에 생성)' },
        },
        required: ['width', 'height'],
      },
    },
  ],

  async handle(name: string, args: Record<string, unknown>): Promise<string> {
    switch (name) {
      case 'file_md_to_docx': {
        const sourcePath = readRequiredString(args, 'sourcePath');
        const outputPath = readOptionalString(args, 'outputPath');
        return formatConvertResult(await mdToDocx(sourcePath, outputPath));
      }
      case 'file_md_to_pdf': {
        const sourcePath = readRequiredString(args, 'sourcePath');
        const outputPath = readOptionalString(args, 'outputPath');
        return formatConvertResult(await mdToPdf(sourcePath, outputPath));
      }
      case 'file_generate_image': {
        const width = readNumber(args, 'width', 0);
        const height = readNumber(args, 'height', 0);
        const background = readOptionalString(args, 'background');
        const text = readOptionalString(args, 'text');
        const formatStr = readOptionalString(args, 'format') as 'png' | 'jpeg' | 'webp' | undefined;
        const outputPath = readOptionalString(args, 'outputPath');
        const result = await generateImage({ width, height, background, text, format: formatStr, outputPath });
        return formatGenerateImageResult(result, width, height);
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  },
};
