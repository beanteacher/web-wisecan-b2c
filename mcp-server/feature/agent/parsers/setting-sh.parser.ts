import * as fs from 'fs';
import * as path from 'path';
import { AgentDto } from '@/feature/agent/dto';

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, '');
}

function resolveVariables(value: string, env: Map<string, string>): string {
  let resolved = value;
  for (let i = 0; i < 10; i++) {
    const prev = resolved;
    resolved = resolved.replace(/\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, braced, bare) => {
      const name = braced ?? bare;
      return env.get(name) ?? (braced ? `\${${name}}` : `$${name}`);
    });
    if (resolved === prev) break;
  }
  return resolved;
}

export async function parseSettingSh(agentHome: string): Promise<AgentDto.SettingResult> {
  const filePath = path.resolve(agentHome, 'bin_linux', 'setting.sh');

  const result: AgentDto.SettingResult = { agentHome };

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return result;
  }

  const env = new Map<string, string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    // Strip leading export keyword if present
    const stripped = line.replace(/^export[ \t]+/, '');
    const match = stripped.match(/^([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*(.*)$/);
    if (match) {
      const key = match[1];
      const val = resolveVariables(stripQuotes(match[2].trim()), env);
      env.set(key, val);
    }
  }

  if (env.has('AGENT_HOME')) result.agentHome = env.get('AGENT_HOME')!;
  if (env.has('JAVA_HOME')) result.javaHome = env.get('JAVA_HOME');
  if (env.has('JAR_PATH')) result.jarPath = env.get('JAR_PATH');
  if (env.has('JVM_OPTS')) result.jvmOpts = env.get('JVM_OPTS');
  if (env.has('SERVICE_START_CLASS')) result.serviceStartClass = env.get('SERVICE_START_CLASS');

  return result;
}
