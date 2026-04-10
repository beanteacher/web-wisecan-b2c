export namespace FileDto {
  export interface ConvertResult {
    outputPath: string;
    sizeBytes: number;
  }

  export type MdBlock =
    | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string; bid: string }
    | { type: 'paragraph'; text: string }
    | { type: 'bullet'; text: string; level: number }
    | { type: 'numbered'; num: string; text: string }
    | { type: 'blockquote'; text: string }
    | { type: 'code'; text: string }
    | { type: 'table'; headers: string[]; rows: string[][] };

  export interface GenerateImageOptions {
    width: number;
    height: number;
    background?: string;
    text?: string;
    format?: 'png' | 'jpeg' | 'webp';
    outputPath?: string;
  }
}
