import * as fs from 'fs';
import * as path from 'path';
import { AgentDto } from '@/feature/agent/dto';

function resolveVariables(value: string, env: Map<string, string>): string {
  let resolved = value;
  for (let i = 0; i < 10; i++) {
    const prev = resolved;
    resolved = resolved.replace(/%([^%]+)%/g, (_, name) => env.get(name) ?? `%${name}%`);
    if (resolved === prev) break;
  }
  return resolved;
}

export async function parseSettingCmd(agentHome: string): Promise<AgentDto.SettingResult> {
  const filePath = path.resolve(agentHome, 'bin_win', 'setting.cmd');

  const result: AgentDto.SettingResult = { agentHome };

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return result;
  }

  const env = new Map<string, string>();
  const setPattern = /^[ \t]*SET[ \t]+([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*(.*)$/im;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^SET[ \t]+([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*(.*)$/i);
    if (match) {
      const key = match[1].toUpperCase();
      const val = resolveVariables(match[2].trim(), env);
      env.set(key, val);
    }
  }

  if (env.has('JAVA_HOME')) result.javaHome = env.get('JAVA_HOME');
  if (env.has('JAR_PATH')) result.jarPath = env.get('JAR_PATH');
  if (env.has('JVM_OPTS')) result.jvmOpts = env.get('JVM_OPTS');
  if (env.has('SERVICE_START_CLASS')) result.serviceStartClass = env.get('SERVICE_START_CLASS');

  // Override agentHome if explicitly set in file
  if (env.has('AGENT_HOME')) result.agentHome = env.get('AGENT_HOME')!;

  return result;
}
