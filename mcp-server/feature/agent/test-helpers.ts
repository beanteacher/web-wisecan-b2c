import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-test-'));
}

export function writeAgentFixtures(
  tmpDir: string,
  opts?: {
    os?: 'windows' | 'linux';
    agentConf?: string;
    jdbcConf?: string;
    settingContent?: string;
    logs?: Record<string, string>;
  },
) {
  const osType = opts?.os ?? 'windows';
  const binDir = path.join(tmpDir, osType === 'windows' ? 'bin_win' : 'bin_linux');
  const confDir = path.join(tmpDir, 'conf');
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(confDir, { recursive: true });

  // JAVA_HOME을 tmpDir 내부에 생성하여 파일 존재 검증 통과
  const javaHomeDir = path.join(tmpDir, 'jdk');
  const javaBinDir = path.join(javaHomeDir, 'bin');
  fs.mkdirSync(javaBinDir, { recursive: true });
  const javaExe = osType === 'windows' ? 'java.exe' : 'java';
  fs.writeFileSync(path.join(javaBinDir, javaExe), '');

  const settingFile = osType === 'windows' ? 'setting.cmd' : 'setting.sh';
  const defaultSetting =
    osType === 'windows'
      ? `SET JAVA_HOME=${javaHomeDir}\r\nSET JVM_OPTS=-Xmx256m\r\n`
      : `export JAVA_HOME=${javaHomeDir}\nexport JVM_OPTS="-Xmx256m"\n`;
  fs.writeFileSync(path.join(binDir, settingFile), opts?.settingContent ?? defaultSetting);

  fs.writeFileSync(
    path.join(confDir, 'agent.conf'),
    opts?.agentConf ??
      [
        'agent.sms.use=Y',
        'agent.lms.use=N',
        'agent.mms.use=Y',
        'agent.kko.use=N',
        'agent.relay.sms.ip=10.0.0.1',
        'agent.relay.sms.port=9090',
        'agent.send.table.sms=SMS_TRAN',
        'agent.send.table.mms=MMS_TRAN',
      ].join('\n'),
  );

  fs.writeFileSync(
    path.join(confDir, 'jdbc.conf'),
    opts?.jdbcConf ??
      [
        'jdbc.driver=com.mysql.cj.jdbc.Driver',
        'jdbc.url=jdbc:mysql://localhost:3306/testdb',
        'jdbc.username=root',
        'jdbc.password=secret',
      ].join('\n'),
  );

  if (opts?.logs) {
    const logsDir = path.join(tmpDir, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    for (const [name, content] of Object.entries(opts.logs)) {
      fs.writeFileSync(path.join(logsDir, name), content);
    }
  }
}
