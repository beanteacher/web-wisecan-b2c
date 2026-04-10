import * as path from 'path';
import { AgentDto } from './dto';
import { detectOs } from './shared';
import { parseSettingCmd } from './parsers/setting-cmd.parser';
import { parseSettingSh } from './parsers/setting-sh.parser';
import { parseAgentConf } from './parsers/agent-conf.parser';
import { parseJdbcConf } from './parsers/jdbc-conf.parser';

export async function analyzeConfig(
  agentHome: string,
  os?: 'windows' | 'linux',
): Promise<AgentDto.ConfigResult> {
  const resolvedHome = path.resolve(agentHome);

  const detectedOs = os ?? detectOs(resolvedHome);

  const [setting, agentConf, jdbcConf] = await Promise.all([
    detectedOs === 'windows' ? parseSettingCmd(resolvedHome) : parseSettingSh(resolvedHome),
    parseAgentConf(resolvedHome),
    parseJdbcConf(resolvedHome),
  ]);

  const isEnabled = (v?: string) => v === 'Y' || v === 'true';
  const activeMessageTypes: string[] = [];
  if (isEnabled(agentConf.smsUse)) activeMessageTypes.push('SMS');
  if (isEnabled(agentConf.lmsUse)) activeMessageTypes.push('LMS');
  if (isEnabled(agentConf.mmsUse)) activeMessageTypes.push('MMS');
  if (isEnabled(agentConf.kkoUse)) activeMessageTypes.push('KKO');

  const { password: _pw, ...jdbcWithoutPassword } = jdbcConf;
  const maskedJdbc = { ...jdbcWithoutPassword, password: '****' as const };

  return {
    os: detectedOs,
    setting,
    agentConf,
    jdbcConf: maskedJdbc,
    activeMessageTypes,
  };
}

export function formatAnalyzeConfig(result: AgentDto.ConfigResult): string {
  return JSON.stringify(result, null, 2);
}
