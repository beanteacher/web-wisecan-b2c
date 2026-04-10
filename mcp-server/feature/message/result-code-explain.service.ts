import { RESULT_CODE_MAP } from './shared';
import { MessageDto } from './dto';

export type MessageResultCodeExplainInput = MessageDto.MessageResultCodeExplainInput;

function guessCategory(code: string): string {
  const prefix = code.charAt(0);
  switch (prefix) {
    case '1': return '성공';
    case '2': return '형식오류';
    case '3': return '인증오류';
    case '4': return '수신오류';
    case '5': return '시스템오류';
    default: return '기타';
  }
}

export function messageResultCodeExplain(input: MessageResultCodeExplainInput): string {
  if (input.resultCode) {
    const entry = RESULT_CODE_MAP[input.resultCode];
    if (entry) {
      return `${input.resultCode}: ${entry.description} [${entry.category}] ${entry.retryable ? '(재시도 가능)' : '(재시도 불가)'}`;
    }
    const category = guessCategory(input.resultCode);
    const retryable = input.resultCode.startsWith('4') || input.resultCode.startsWith('5');
    return `${input.resultCode}: 알 수 없는 결과코드 [${category}] ${retryable ? '(재시도 가능)' : '(재시도 불가)'}`;
  }

  return Object.entries(RESULT_CODE_MAP)
    .map(([code, info]) =>
      `${code}: ${info.description} [${info.category}] ${info.retryable ? '(재시도 가능)' : '(재시도 불가)'}`
    )
    .join('\n');
}
