import { analyzeConfig, formatAnalyzeConfig } from '@/feature/agent/analyze-config.service';
import { analyzeLogs, formatAnalyzeLogs } from '@/feature/agent/analyze-logs.service';
import { diagnose, formatDiagnose } from '@/feature/agent/diagnose.service';
import { testDb, formatTestDb } from '@/feature/agent/test-db.service';
import { insertSample, formatInsertSample } from '@/feature/agent/insert-sample.service';
import { ToolModule } from '@/mcp/types';
import { readRequiredString, readOptionalString, readNumber } from '@/mcp/utils';

export const agentModule: ToolModule = {
  tools: [
    {
      name: 'agent_analyze_config',
      description: '에이전트 설정 파일(setting.cmd/sh, agent.conf, jdbc.conf)을 파싱해 요약합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          agentHome: { type: 'string', description: '에이전트 루트 경로' },
          os: { type: 'string', description: 'windows|linux (미입력 시 자동 감지)' },
        },
        required: ['agentHome'],
      },
    },
    {
      name: 'agent_analyze_logs',
      description: 'logs/ 디렉토리를 스캔해 ERROR/WARN 항목을 추출하고 분류합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          agentHome: { type: 'string', description: '에이전트 루트 경로' },
        },
        required: ['agentHome'],
      },
    },
    {
      name: 'agent_diagnose',
      description: '설정과 로그를 종합 분석해 문제 원인과 권고 조치를 반환합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          agentHome: { type: 'string', description: '에이전트 루트 경로' },
          os: { type: 'string', description: 'windows|linux (미입력 시 자동 감지)' },
        },
        required: ['agentHome'],
      },
    },
    {
      name: 'agent_test_db',
      description: 'jdbc.conf 정보를 기반으로 실제 DB 연결을 테스트합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          agentHome: { type: 'string', description: '에이전트 루트 경로' },
        },
        required: ['agentHome'],
      },
    },
    {
      name: 'agent_insert_sample',
      description: 'agent.conf 테이블명 기반으로 샘플 메시지를 INSERT해 발송 테스트를 지원합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          agentHome: { type: 'string', description: '에이전트 루트 경로' },
          messageType: { type: 'string', description: 'sms|lms|mms|kko (기본 sms)' },
          destaddr: { type: 'string', description: '수신 번호 (기본 01000000000)' },
          sendMsg: { type: 'string', description: "[테스트] 메시지 본문 (기본 '[테스트] 샘플 메시지')" },
          count: { type: 'number', description: '삽입 건수 (기본 1, 최대 10)' },
        },
        required: ['agentHome'],
      },
    },
  ],

  async handle(name, args) {
    switch (name) {
      case 'agent_analyze_config': {
        const result = await analyzeConfig(readRequiredString(args, 'agentHome'), readOptionalString(args, 'os') as 'windows' | 'linux' | undefined);
        return formatAnalyzeConfig(result);
      }

      case 'agent_analyze_logs': {
        const result = await analyzeLogs(readRequiredString(args, 'agentHome'));
        return formatAnalyzeLogs(result);
      }

      case 'agent_diagnose': {
        const result = await diagnose(readRequiredString(args, 'agentHome'), readOptionalString(args, 'os') as 'windows' | 'linux' | undefined);
        return formatDiagnose(result);
      }

      case 'agent_test_db': {
        const result = await testDb(readRequiredString(args, 'agentHome'));
        return formatTestDb(result);
      }

      case 'agent_insert_sample': {
        const result = await insertSample(readRequiredString(args, 'agentHome'), {
          messageType: readOptionalString(args, 'messageType'),
          destaddr: readOptionalString(args, 'destaddr'),
          sendMsg: readOptionalString(args, 'sendMsg'),
          count: args['count'] !== undefined ? readNumber(args, 'count', 1) : undefined,
        });
        return formatInsertSample(result);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  },
};
