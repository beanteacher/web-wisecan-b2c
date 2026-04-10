import * as fs from 'fs';
import * as path from 'path';
import { AgentDto } from '@/feature/agent/dto';

export async function parseAgentConf(agentHome: string): Promise<AgentDto.AgentConfResult> {
  const filePath = path.resolve(agentHome, 'conf', 'agent.conf');

  const result: AgentDto.AgentConfResult = {};

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return result;
  }

  const props = new Map<string, string>();

  for (const rawLine of content.split(/\r?\n/)) {
    // Remove inline and full-line comments
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();
    props.set(key, value);
  }

  if (props.has('agent.relay.sms.ip')) result.relaySmsIp = props.get('agent.relay.sms.ip');
  if (props.has('agent.relay.sms.port')) result.relaySmsPort = props.get('agent.relay.sms.port');
  if (props.has('agent.relay.mms.ip')) result.relayMmsIp = props.get('agent.relay.mms.ip');
  if (props.has('agent.relay.mms.port')) result.relayMmsPort = props.get('agent.relay.mms.port');
  if (props.has('agent.sms.use')) result.smsUse = props.get('agent.sms.use');
  if (props.has('agent.lms.use')) result.lmsUse = props.get('agent.lms.use');
  if (props.has('agent.mms.use')) result.mmsUse = props.get('agent.mms.use');
  if (props.has('agent.kko.use')) result.kkoUse = props.get('agent.kko.use');
  if (props.has('agent.send.table.sms')) result.sendTableSms = props.get('agent.send.table.sms');
  if (props.has('agent.send.table.mms')) result.sendTableMms = props.get('agent.send.table.mms');
  if (props.has('agent.send.table.kko')) result.sendTableKko = props.get('agent.send.table.kko');
  if (props.has('agent.fetch.delay')) result.fetchDelay = props.get('agent.fetch.delay');
  if (props.has('agent.complete.delay')) result.completeDelay = props.get('agent.complete.delay');

  return result;
}
