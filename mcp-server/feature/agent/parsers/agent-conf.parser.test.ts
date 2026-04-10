import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseAgentConf } from './agent-conf.parser';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-test-'));
}

describe('parseAgentConf', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('conf/agent.conf가 없으면 빈 객체 반환', async () => {
    const result = await parseAgentConf(tmpDir);
    expect(result).toEqual({});
  });

  it('key=value 쌍을 올바르게 파싱', async () => {
    const confDir = path.join(tmpDir, 'conf');
    fs.mkdirSync(confDir, { recursive: true });
    fs.writeFileSync(
      path.join(confDir, 'agent.conf'),
      [
        'agent.relay.sms.ip=10.0.0.1',
        'agent.relay.sms.port=9090',
        'agent.relay.mms.ip=10.0.0.2',
        'agent.relay.mms.port=9091',
        'agent.sms.use=Y',
        'agent.lms.use=N',
        'agent.mms.use=Y',
        'agent.kko.use=N',
        'agent.send.table.sms=SMS_TRAN',
        'agent.send.table.mms=MMS_TRAN',
        'agent.send.table.kko=KKO_TRAN',
        'agent.fetch.delay=1000',
        'agent.complete.delay=500',
      ].join('\n'),
    );

    const result = await parseAgentConf(tmpDir);
    expect(result.relaySmsIp).toBe('10.0.0.1');
    expect(result.relaySmsPort).toBe('9090');
    expect(result.relayMmsIp).toBe('10.0.0.2');
    expect(result.relayMmsPort).toBe('9091');
    expect(result.smsUse).toBe('Y');
    expect(result.lmsUse).toBe('N');
    expect(result.mmsUse).toBe('Y');
    expect(result.kkoUse).toBe('N');
    expect(result.sendTableSms).toBe('SMS_TRAN');
    expect(result.sendTableMms).toBe('MMS_TRAN');
    expect(result.sendTableKko).toBe('KKO_TRAN');
    expect(result.fetchDelay).toBe('1000');
    expect(result.completeDelay).toBe('500');
  });

  it('주석과 빈 줄을 무시', async () => {
    const confDir = path.join(tmpDir, 'conf');
    fs.mkdirSync(confDir, { recursive: true });
    fs.writeFileSync(
      path.join(confDir, 'agent.conf'),
      [
        '# 릴레이 설정',
        '',
        'agent.sms.use=Y',
        'agent.lms.use=N  # 인라인 주석',
        '',
      ].join('\n'),
    );

    const result = await parseAgentConf(tmpDir);
    expect(result.smsUse).toBe('Y');
    expect(result.lmsUse).toBe('N');
  });
});
