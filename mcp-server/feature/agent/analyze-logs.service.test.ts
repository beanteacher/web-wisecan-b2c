import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { analyzeLogs } from './analyze-logs.service';
import { makeTmpDir, writeAgentFixtures } from './test-helpers';

describe('analyzeLogs', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('logs 디렉토리가 없으면 빈 결과', async () => {
    const result = await analyzeLogs(tmpDir);
    expect(result.entries).toEqual([]);
    expect(result.summary).toEqual({});
  });

  it('ERROR/WARN 라인을 추출하고 카테고리 분류', async () => {
    writeAgentFixtures(tmpDir, {
      logs: {
        'agent.log': [
          '2026-03-18 10:00:00 INFO  - Agent started',
          '2026-03-18 10:01:00 ERROR - Communications link failure',
          '2026-03-18 10:02:00 ERROR - Table SMS_TRAN doesn\'t exist',
          '2026-03-18 10:03:00 WARN  - relay socket Connection timed out',
          '2026-03-18 10:04:00 ERROR - java.lang.OutOfMemoryError: Java heap space',
          '2026-03-18 10:05:00 ERROR - Could not find or load main class com.example.Main',
          '2026-03-18 10:06:00 ERROR - Something unknown happened',
        ].join('\n'),
      },
    });

    const result = await analyzeLogs(tmpDir);
    expect(result.entries.length).toBe(6);
    expect(result.summary['DB_CONNECTION_FAILED']).toBe(1);
    expect(result.summary['TABLE_NOT_FOUND']).toBe(1);
    expect(result.summary['RELAY_CONNECTION_FAILED']).toBe(1);
    expect(result.summary['JVM_MEMORY']).toBe(1);
    expect(result.summary['CLASSPATH_ERROR']).toBe(1);
    expect(result.summary['UNKNOWN']).toBe(1);
  });

  it('날짜 패턴이 있는 파일은 무시 (아카이브 로그)', async () => {
    writeAgentFixtures(tmpDir, {
      logs: {
        'agent.log': '2026-03-18 ERROR - test error\n',
        'agent.20260317.log': '2026-03-17 ERROR - old error\n',
        'agent.2026-03-16.log': '2026-03-16 ERROR - old error 2\n',
      },
    });

    const result = await analyzeLogs(tmpDir);
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].file).toBe('agent.log');
  });
});
