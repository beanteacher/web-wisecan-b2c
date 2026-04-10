import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseSettingSh } from './setting-sh.parser';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-test-'));
}

describe('parseSettingSh', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('bin_linux/setting.sh가 없으면 agentHome만 반환', async () => {
    const result = await parseSettingSh(tmpDir);
    expect(result).toEqual({ agentHome: tmpDir });
  });

  it('export 변수를 올바르게 파싱', async () => {
    const binDir = path.join(tmpDir, 'bin_linux');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(
      path.join(binDir, 'setting.sh'),
      [
        'export JAVA_HOME=/usr/lib/jvm/java-8',
        'export JAR_PATH=lib/agent.jar',
        'export JVM_OPTS="-Xmx512m"',
        'export SERVICE_START_CLASS=com.example.Main',
      ].join('\n'),
    );

    const result = await parseSettingSh(tmpDir);
    expect(result.javaHome).toBe('/usr/lib/jvm/java-8');
    expect(result.jarPath).toBe('lib/agent.jar');
    expect(result.jvmOpts).toBe('-Xmx512m');
    expect(result.serviceStartClass).toBe('com.example.Main');
  });

  it('$변수 및 ${변수} 참조를 resolve', async () => {
    const binDir = path.join(tmpDir, 'bin_linux');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(
      path.join(binDir, 'setting.sh'),
      ['AGENT_HOME=/opt/agent', 'JAR_PATH=${AGENT_HOME}/lib/agent.jar'].join('\n'),
    );

    const result = await parseSettingSh(tmpDir);
    expect(result.agentHome).toBe('/opt/agent');
    expect(result.jarPath).toBe('/opt/agent/lib/agent.jar');
  });

  it('따옴표를 제거', async () => {
    const binDir = path.join(tmpDir, 'bin_linux');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(
      path.join(binDir, 'setting.sh'),
      'export JAVA_HOME="/usr/lib/jvm/java-11"\n',
    );

    const result = await parseSettingSh(tmpDir);
    expect(result.javaHome).toBe('/usr/lib/jvm/java-11');
  });

  it('export 없이도 변수 파싱', async () => {
    const binDir = path.join(tmpDir, 'bin_linux');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(binDir, 'setting.sh'), 'JAVA_HOME=/usr/lib/jvm/java-8\n');

    const result = await parseSettingSh(tmpDir);
    expect(result.javaHome).toBe('/usr/lib/jvm/java-8');
  });
});
