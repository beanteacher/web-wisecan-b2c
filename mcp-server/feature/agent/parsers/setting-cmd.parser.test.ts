import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseSettingCmd } from './setting-cmd.parser';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-test-'));
}

describe('parseSettingCmd', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('bin_win/setting.cmd가 없으면 agentHome만 반환', async () => {
    const result = await parseSettingCmd(tmpDir);
    expect(result).toEqual({ agentHome: tmpDir });
  });

  it('SET 변수를 올바르게 파싱', async () => {
    const binDir = path.join(tmpDir, 'bin_win');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(
      path.join(binDir, 'setting.cmd'),
      [
        'SET JAVA_HOME=C:\\Java\\jdk1.8',
        'SET JAR_PATH=lib\\agent.jar',
        'SET JVM_OPTS=-Xmx512m',
        'SET SERVICE_START_CLASS=com.example.Main',
      ].join('\r\n'),
    );

    const result = await parseSettingCmd(tmpDir);
    expect(result.javaHome).toBe('C:\\Java\\jdk1.8');
    expect(result.jarPath).toBe('lib\\agent.jar');
    expect(result.jvmOpts).toBe('-Xmx512m');
    expect(result.serviceStartClass).toBe('com.example.Main');
  });

  it('%변수% 참조를 resolve', async () => {
    const binDir = path.join(tmpDir, 'bin_win');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(
      path.join(binDir, 'setting.cmd'),
      ['SET AGENT_HOME=C:\\agent', 'SET JAR_PATH=%AGENT_HOME%\\lib\\agent.jar'].join('\r\n'),
    );

    const result = await parseSettingCmd(tmpDir);
    expect(result.agentHome).toBe('C:\\agent');
    expect(result.jarPath).toBe('C:\\agent\\lib\\agent.jar');
  });

  it('AGENT_HOME이 설정파일에 있으면 agentHome을 오버라이드', async () => {
    const binDir = path.join(tmpDir, 'bin_win');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(binDir, 'setting.cmd'), 'SET AGENT_HOME=D:\\custom\\path\r\n');

    const result = await parseSettingCmd(tmpDir);
    expect(result.agentHome).toBe('D:\\custom\\path');
  });

  it('대소문자 무관하게 SET 인식', async () => {
    const binDir = path.join(tmpDir, 'bin_win');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(binDir, 'setting.cmd'), 'set java_home=C:\\Java\\jdk\r\n');

    const result = await parseSettingCmd(tmpDir);
    expect(result.javaHome).toBe('C:\\Java\\jdk');
  });
});
