import { messageGetResult } from '@/feature/message/get-result.service';
import { messageSend, formatSendResult } from '@/feature/message/send.service';
import { messageSearch } from '@/feature/message/search.service';
import { messageFindFailures } from '@/feature/message/find-failures.service';
import { messageResultCodeExplain } from '@/feature/message/result-code-explain.service';
import { messageCheckPending } from '@/feature/message/check-pending.service';
import { messageRetry } from '@/feature/message/retry.service';
import { messageCancel } from '@/feature/message/cancel-service';
import { messageStatSummary } from '@/feature/message/stat-summary.service';
import { messageDiagnoseFailures } from '@/feature/message/diagnose-failures.service';
import { messageDailyReport } from '@/feature/message/daily-report.service';
import { messageWeeklyReport } from '@/feature/message/weekly-report.service';
import { messageChannelBreakdown } from '@/feature/message/channel-breakdown-service';
import { messageDeliveryTimeStats } from '@/feature/message/delivery-time-stats.service';
import { messageTrendCompare } from '@/feature/message/trend-compare.service';
import { ToolModule } from '@/mcp/types';
import { readRequiredString, readOptionalString, readNumber } from '@/mcp/utils';

function readStringArray(args: Record<string, unknown>, key: string): string[] | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.map(v => String(v));
  if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean);
  throw new Error(`${key}는 문자열 배열이어야 합니다.`);
}

export const messageModule: ToolModule = {
  tools: [
    {
      name: 'message_get_result',
      description: 'msgId와 발송일로 발송 결과를 단건 조회합니다. LOG 테이블(YYYYMMDD/YYYYMM)을 자동 탐색하여 결과를 반환합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          msgId: { type: 'string', description: '메시지 ID (정수 문자열)' },
          date: { type: 'string', description: '발송일 (YYYY-MM-DD 또는 YYYYMM). LOG 테이블 suffix 결정에 사용' },
          msgType: { type: 'string', description: '채널 (SMS/MMS/KKO/RCS). 미지정 시 전체 채널 탐색' },
        },
        required: ['msgId', 'date'],
      },
    },
    {
      name: 'message_search',
      description: '다중 조건으로 발송 결과를 검색합니다. 날짜/수신번호/채널/상태 등 조합 검색 + 페이징을 지원합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string', description: '검색 시작일시 (ISO 8601 또는 YYYY-MM-DD, 기본: 오늘 00:00 KST)' },
          dateTo: { type: 'string', description: '검색 종료일시' },
          destaddr: { type: 'string', description: '수신번호 (부분 일치)' },
          msgType: { type: 'string', description: '채널 필터 (SMS/MMS/KKO/RCS 또는 세부유형)' },
          messageState: { type: 'number', description: '발송상태 (0=대기, 1=처리중, 2=성공, 3=실패, 4=취소)' },
          userId: { type: 'string', description: '발송 요청자' },
          groupId: { type: 'string', description: '그룹 ID' },
          page: { type: 'number', description: '페이지 번호 (기본: 1)' },
          size: { type: 'number', description: '페이지 크기 (기본: 20, 최대: 100)' },
        },
      },
    },
    {
      name: 'message_find_failures',
      description: '실패 건만 필터링하여 조회합니다. resultCode별 건수 요약도 함께 반환합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string', description: '검색 시작일시' },
          dateTo: { type: 'string', description: '검색 종료일시' },
          msgType: { type: 'string', description: '채널 필터' },
          resultCode: { type: 'string', description: '특정 결과코드만 필터' },
          page: { type: 'number', description: '페이지 번호 (기본: 1)' },
          size: { type: 'number', description: '페이지 크기 (기본: 20, 최대: 100)' },
        },
      },
    },
    {
      name: 'message_result_code_explain',
      description: '통신사 결과코드(resultCode)를 사람이 읽을 수 있는 사유로 해석합니다. 코드 미지정 시 전체 목록을 반환합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          resultCode: { type: 'string', description: '조회할 결과코드 (미지정 시 전체 목록)' },
        },
      },
    },
    {
      name: 'message_check_pending',
      description: '현재 대기/처리중 상태인 건수를 채널별로 조회합니다. 일정 시간 이상 체류 중인 건 경고도 제공합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          olderThanMinutes: { type: 'number', description: 'N분 이상 대기 중인 건만 (기본: 0 = 전체)' },
          msgType: { type: 'string', description: '채널 필터' },
        },
      },
    },
    {
      name: 'message_retry',
      description: '실패 건의 messageState를 대기(0)로 리셋하여 재발송 대기열에 복귀시킵니다. msgIds 또는 조건(resultCode+기간)으로 지정합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          msgIds: { type: 'array', items: { type: 'string' }, description: '재발송할 메시지 ID 목록' },
          resultCode: { type: 'string', description: '이 결과코드의 실패 건 일괄 재발송' },
          dateFrom: { type: 'string', description: '대상 기간 시작' },
          dateTo: { type: 'string', description: '대상 기간 종료' },
          maxCount: { type: 'number', description: '최대 재발송 건수 (기본: 100)' },
        },
      },
    },
    {
      name: 'message_cancel',
      description: '미발송(대기) 상태인 건을 취소 상태로 변경합니다. msgIds 또는 groupId로 지정합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          msgIds: { type: 'array', items: { type: 'string' }, description: '취소할 메시지 ID 목록' },
          groupId: { type: 'string', description: '그룹 단위 일괄 취소' },
        },
      },
    },
    {
      name: 'message_stat_summary',
      description: '기간별 발송 건수/성공/실패/대기 통계를 집계합니다. 채널별, 시간대별, 일별 groupBy를 지원합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string', description: '시작일시 (기본: 오늘 00:00 KST)' },
          dateTo: { type: 'string', description: '종료일시' },
          groupBy: { type: 'string', enum: ['channel', 'hour', 'day'], description: '그룹핑 기준 (기본: channel)' },
        },
      },
    },
    {
      name: 'message_diagnose_failures',
      description: '실패 건을 시간대/결과코드/통신사 축으로 분석하여 패턴과 추정 원인을 자동 진단합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string', description: '분석 기간 시작' },
          dateTo: { type: 'string', description: '분석 기간 종료' },
          msgType: { type: 'string', description: '채널 필터' },
        },
      },
    },
    {
      name: 'message_daily_report',
      description: '특정 일자의 발송 종합 리포트를 생성합니다. 채널별 성공률, 평균 수신소요시간, top 실패코드, 시간대별 발송량을 포함합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: '대상 일자 (YYYY-MM-DD, 기본: 어제)' },
        },
      },
    },
    {
      name: 'message_weekly_report',
      description: '주간 발송 리포트를 생성합니다. 7일간 일별 추이 표, 채널별 집계, 전주 대비 증감률을 포함합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          weekStartDate: { type: 'string', description: '주간 시작일 (YYYY-MM-DD, 기본: 7일 전)' },
        },
      },
    },
    {
      name: 'message_channel_breakdown',
      description: '채널별 세부유형(subType) 분해 통계입니다. SMS/LMS/MMS/KAT/KAI/RSM 등 세부 유형별 건수·성공률·비중을 표로 반환합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string', description: '시작일시 (기본: 오늘 00:00 KST)' },
          dateTo: { type: 'string', description: '종료일시' },
        },
      },
    },
    {
      name: 'message_delivery_time_stats',
      description: '수신 소요시간 분포를 구간별 히스토그램으로 반환합니다. 1초/5초/10초/30초/60초/5분 구간 + 채널별 평균·최대·최소를 포함합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string', description: '시작일시 (기본: 오늘 00:00 KST)' },
          dateTo: { type: 'string', description: '종료일시' },
          msgType: { type: 'string', description: '채널 필터 (SMS/MMS/KKO/RCS 또는 세부유형)' },
        },
      },
    },
    {
      name: 'message_trend_compare',
      description: '두 기간의 발송 통계를 나란히 비교합니다. 전체 증감률 + 그룹별(채널/시간대) 비교 표를 반환합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          periodA_from: { type: 'string', description: '기간A 시작일시 (기준 기간)' },
          periodA_to: { type: 'string', description: '기간A 종료일시' },
          periodB_from: { type: 'string', description: '기간B 시작일시 (비교 기간)' },
          periodB_to: { type: 'string', description: '기간B 종료일시' },
          groupBy: { type: 'string', enum: ['channel', 'hour'], description: '비교 그룹핑 기준 (기본: channel)' },
        },
        required: ['periodA_from', 'periodA_to', 'periodB_from', 'periodB_to'],
      },
    },
    {
      name: 'message_send',
      description: '채널별 tran 테이블에 메시지 전송 요청을 적재합니다. SMS→sms_tran, LMS/MMS→mms_tran, KKO→kko_tran, RCS→rcs_tran',
      inputSchema: {
        type: 'object',
        properties: {
          msgType: { type: 'string', enum: ['SMS', 'MMS', 'KKO', 'RCS'], description: '메시지 유형 (SMS | MMS | KKO | RCS)' },
          msgSubType: { type: 'string', description: '메시지 세부 유형. SMS→SMS, MMS→LMS/MMS, KKO→KAT/KAI 등, RCS→RSM/RLM/RTT 등' },
          destaddr: { type: 'string', description: '착신 번호' },
          callback: { type: 'string', description: '회신 번호 (필수)' },
          sendMsg: { type: 'string', description: '메시지 본문' },
          subject: { type: 'string', description: '메시지 제목 (최대 120자, SMS 제외)' },
          filePath: { type: 'string', description: '첨부파일 경로 (콤마 구분, 최대 255자)' },
          userId: { type: 'string', description: '발송 사용자 ID' },
          kisaCode: { type: 'string', description: 'KISA 식별 코드' },
          billCode: { type: 'string', description: '과금 코드' },
          groupId: { type: 'string', description: '그룹 ID (정수 문자열)' },
          requestDate: { type: 'string', description: '전송 희망 일시(ISO 8601)' },
        },
        required: ['msgType', 'msgSubType', 'destaddr', 'callback', 'sendMsg'],
      },
    },
  ],

  async handle(name, args) {
    switch (name) {
      case 'message_get_result':
        return messageGetResult({
          msgId: readRequiredString(args, 'msgId'),
          date: readRequiredString(args, 'date'),
          msgType: readOptionalString(args, 'msgType'),
        });

      case 'message_search':
        return messageSearch({
          dateFrom: readOptionalString(args, 'dateFrom'),
          dateTo: readOptionalString(args, 'dateTo'),
          destaddr: readOptionalString(args, 'destaddr'),
          msgType: readOptionalString(args, 'msgType'),
          messageState: args.messageState !== undefined ? readNumber(args, 'messageState', 0) : undefined,
          userId: readOptionalString(args, 'userId'),
          groupId: readOptionalString(args, 'groupId'),
          page: readNumber(args, 'page', 1),
          size: readNumber(args, 'size', 20),
        });

      case 'message_find_failures':
        return messageFindFailures({
          dateFrom: readOptionalString(args, 'dateFrom'),
          dateTo: readOptionalString(args, 'dateTo'),
          msgType: readOptionalString(args, 'msgType'),
          resultCode: readOptionalString(args, 'resultCode'),
          page: readNumber(args, 'page', 1),
          size: readNumber(args, 'size', 20),
        });

      case 'message_result_code_explain':
        return messageResultCodeExplain({
          resultCode: readOptionalString(args, 'resultCode'),
        });

      case 'message_check_pending':
        return messageCheckPending({
          olderThanMinutes: args.olderThanMinutes !== undefined ? readNumber(args, 'olderThanMinutes', 0) : undefined,
          msgType: readOptionalString(args, 'msgType'),
        });

      case 'message_retry':
        return messageRetry({
          msgIds: readStringArray(args, 'msgIds'),
          resultCode: readOptionalString(args, 'resultCode'),
          dateFrom: readOptionalString(args, 'dateFrom'),
          dateTo: readOptionalString(args, 'dateTo'),
          maxCount: args.maxCount !== undefined ? readNumber(args, 'maxCount', 100) : undefined,
        });

      case 'message_cancel':
        return messageCancel({
          msgIds: readStringArray(args, 'msgIds'),
          groupId: readOptionalString(args, 'groupId'),
        });

      case 'message_stat_summary':
        return messageStatSummary({
          dateFrom: readOptionalString(args, 'dateFrom'),
          dateTo: readOptionalString(args, 'dateTo'),
          groupBy: readOptionalString(args, 'groupBy'),
        });

      case 'message_diagnose_failures':
        return messageDiagnoseFailures({
          dateFrom: readOptionalString(args, 'dateFrom'),
          dateTo: readOptionalString(args, 'dateTo'),
          msgType: readOptionalString(args, 'msgType'),
        });

      case 'message_daily_report':
        return messageDailyReport({
          date: readOptionalString(args, 'date'),
        });

      case 'message_weekly_report':
        return messageWeeklyReport({
          weekStartDate: readOptionalString(args, 'weekStartDate'),
        });

      case 'message_channel_breakdown':
        return messageChannelBreakdown({
          dateFrom: readOptionalString(args, 'dateFrom'),
          dateTo: readOptionalString(args, 'dateTo'),
        });

      case 'message_delivery_time_stats':
        return messageDeliveryTimeStats({
          dateFrom: readOptionalString(args, 'dateFrom'),
          dateTo: readOptionalString(args, 'dateTo'),
          msgType: readOptionalString(args, 'msgType'),
        });

      case 'message_trend_compare':
        return messageTrendCompare({
          periodA_from: readRequiredString(args, 'periodA_from'),
          periodA_to: readRequiredString(args, 'periodA_to'),
          periodB_from: readRequiredString(args, 'periodB_from'),
          periodB_to: readRequiredString(args, 'periodB_to'),
          groupBy: readOptionalString(args, 'groupBy'),
        });

      case 'message_send': {
        const result = await messageSend({
          msgType: readRequiredString(args, 'msgType'),
          msgSubType: readRequiredString(args, 'msgSubType'),
          destaddr: readRequiredString(args, 'destaddr'),
          callback: readRequiredString(args, 'callback'),
          sendMsg: readRequiredString(args, 'sendMsg'),
          subject: readOptionalString(args, 'subject'),
          filePath: readOptionalString(args, 'filePath'),
          userId: readOptionalString(args, 'userId'),
          kisaCode: readOptionalString(args, 'kisaCode'),
          billCode: readOptionalString(args, 'billCode'),
          groupId: readOptionalString(args, 'groupId'),
          requestDate: readOptionalString(args, 'requestDate'),
        });
        return formatSendResult(result);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  },
};
