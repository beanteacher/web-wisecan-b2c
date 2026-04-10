import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { analyzeConfig } from './analyze-config.service';
import { makeTmpDir, writeAgentFixtures } from './test-helpers';

describe('analyzeConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Windows 환경에서 설정 분석', async () => {
    writeAgentFixtures(tmpDir, { os: 'windows' });

    const result = await analyzeConfig(tmpDir);
    expect(result.os).toBe('windows');
    expect(result.setting.javaHome).toContain('jdk');
    expect(result.agentConf.smsUse).toBe('Y');
    expect(result.jdbcConf.dbType).toBe('mysql');
    expect(result.jdbcConf.password).toBe('****');
    expect(result.activeMessageTypes).toEqual(['SMS', 'MMS']);
  });

  it('Linux 환경에서 설정 분석', async () => {
    writeAgentFixtures(tmpDir, { os: 'linux' });

    const result = await analyzeConfig(tmpDir, 'linux');
    expect(result.os).toBe('linux');
    expect(result.setting.javaHome).toContain('jdk');
  });

  it('활성 메시지 타입이 없으면 빈 배열', async () => {
    writeAgentFixtures(tmpDir, {
      agentConf: [
        'agent.sms.use=N',
        'agent.lms.use=N',
        'agent.mms.use=N',
        'agent.kko.use=N',
      ].join('\n'),
    });

    const result = await analyzeConfig(tmpDir);
    expect(result.activeMessageTypes).toEqual([]);
  });

  it('password는 **** 마스킹', async () => {
    writeAgentFixtures(tmpDir);

    const result = await analyzeConfig(tmpDir);
    expect(result.jdbcConf.password).toBe('****');
  });
});
