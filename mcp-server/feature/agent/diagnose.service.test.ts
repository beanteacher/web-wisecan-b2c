import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { diagnose } from './diagnose.service';
import { makeTmpDir, writeAgentFixtures } from './test-helpers';

describe('diagnose', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('문제 없으면 healthy=true', async () => {
    writeAgentFixtures(tmpDir);

    const result = await diagnose(tmpDir);
    expect(result.healthy).toBe(true);
    expect(result.config.os).toBe('windows');
  });

  it('DB 연결 에러 로그가 있으면 이슈 감지', async () => {
    writeAgentFixtures(tmpDir, {
      logs: {
        'agent.log': '2026-03-18 ERROR - Communications link failure\n',
      },
    });

    const result = await diagnose(tmpDir);
    expect(result.healthy).toBe(false);
    const dbIssue = result.issues.find((i) => i.category === 'DB_CONNECTION_FAILED');
    expect(dbIssue).toBeDefined();
    expect(dbIssue!.severity).toBe('ERROR');
  });

  it('활성 메시지 타입 없으면 WARN 이슈', async () => {
    writeAgentFixtures(tmpDir, {
      agentConf: 'agent.sms.use=N\nagent.lms.use=N\nagent.mms.use=N\nagent.kko.use=N\n',
    });

    const result = await diagnose(tmpDir);
    expect(result.healthy).toBe(true); // WARN은 healthy에 영향 없음
    const issue = result.issues.find((i) => i.category === 'NO_ACTIVE_MESSAGE_TYPE');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('WARN');
  });

  it('JAVA_HOME 미설정 시 WARN 이슈', async () => {
    writeAgentFixtures(tmpDir, {
      settingContent: 'SET JVM_OPTS=-Xmx256m\r\n',
    });

    const result = await diagnose(tmpDir);
    const issue = result.issues.find((i) => i.category === 'JAVA_HOME_MISSING');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('WARN');
  });

  it('DB 타입 unknown이면 WARN 이슈', async () => {
    writeAgentFixtures(tmpDir, {
      jdbcConf: 'jdbc.driver=unknown.Driver\njdbc.url=jdbc:unknown://localhost\n',
    });

    const result = await diagnose(tmpDir);
    const issue = result.issues.find((i) => i.category === 'UNKNOWN_DB_TYPE');
    expect(issue).toBeDefined();
  });

  it('여러 에러가 동시에 발생하면 모두 감지', async () => {
    writeAgentFixtures(tmpDir, {
      agentConf: 'agent.sms.use=N\nagent.lms.use=N\nagent.mms.use=N\nagent.kko.use=N\n',
      jdbcConf: 'jdbc.driver=unknown.Driver\n',
      settingContent: 'SET JVM_OPTS=-Xmx256m\r\n',
      logs: {
        'agent.log': [
          'ERROR - Communications link failure',
          'ERROR - OutOfMemoryError',
        ].join('\n'),
      },
    });

    const result = await diagnose(tmpDir);
    expect(result.healthy).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(4);
  });
});
