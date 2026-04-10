import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { AgentDto } from './dto';

function classifyLine(line: string): AgentDto.LogEntry['category'] {
  if (
    /Communications link failure/i.test(line) ||
    /ORA-\d+/.test(line) ||
    /Cannot open database/i.test(line) ||
    /Connection refused/i.test(line) ||
    /Unable to acquire JDBC Connection/i.test(line)
  ) {
    return 'DB_CONNECTION_FAILED';
  }
  if (
    /Table .+ doesn't exist/i.test(line) ||
    /ORA-00942/.test(line) ||
    /Invalid object name/i.test(line)
  ) {
    return 'TABLE_NOT_FOUND';
  }
  if (
    /relay/i.test(line) &&
    (/Connection (refused|timed out|reset)/i.test(line) || /socket/i.test(line))
  ) {
    return 'RELAY_CONNECTION_FAILED';
  }
  if (/OutOfMemoryError/i.test(line) || /GC overhead limit exceeded/i.test(line)) {
    return 'JVM_MEMORY';
  }
  if (
    /Could not find or load main class/i.test(line) ||
    /ClassNotFoundException/i.test(line) ||
    /NoClassDefFoundError/i.test(line) ||
    /Error: .*class.*찾거나 로드/i.test(line)
  ) {
    return 'CLASSPATH_ERROR';
  }
  return 'UNKNOWN';
}

async function parseLogFile(filePath: string): Promise<AgentDto.LogEntry[]> {
  const fileName = path.basename(filePath);
  const entries: AgentDto.LogEntry[] = [];

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const upper = line.toUpperCase();
    let level: 'ERROR' | 'WARN' | null = null;
    if (upper.includes('ERROR')) level = 'ERROR';
    else if (upper.includes('WARN')) level = 'WARN';

    if (level) {
      entries.push({
        file: fileName,
        level,
        line: line.trim(),
        category: classifyLine(line),
      });
    }
  }

  return entries;
}

export async function analyzeLogs(agentHome: string): Promise<AgentDto.LogResult> {
  const logsDir = path.resolve(agentHome, 'logs');

  if (!fs.existsSync(logsDir)) {
    return { entries: [], summary: {} };
  }

  const logFiles = fs
    .readdirSync(logsDir)
    .filter((f) => !/\d{8}|\d{4}-\d{2}-\d{2}/.test(f))
    .map((f) => path.join(logsDir, f))
    .filter((f) => fs.statSync(f).isFile());

  const allEntries = (await Promise.all(logFiles.map(parseLogFile))).flat();

  const summary: Record<string, number> = {};
  for (const entry of allEntries) {
    summary[entry.category] = (summary[entry.category] ?? 0) + 1;
  }

  return { entries: allEntries, summary };
}

export function formatAnalyzeLogs(result: AgentDto.LogResult): string {
  return JSON.stringify(result, null, 2);
}
