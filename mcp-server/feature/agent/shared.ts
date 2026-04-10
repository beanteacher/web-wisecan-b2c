import * as fs from 'fs';
import * as path from 'path';
import { AgentDto } from './dto';

export function parseJdbcUrl(
  url: string,
  dbType: AgentDto.JdbcConfResult['dbType'],
): { host: string; port: number; database: string } | null {
  try {
    if (dbType === 'mysql' || dbType === 'mariadb') {
      const m = url.match(/jdbc:(?:mysql|mariadb):\/\/([^:/]+)(?::(\d+))?\/([^?;]+)/i);
      if (m) return { host: m[1], port: m[2] ? parseInt(m[2]) : 3306, database: m[3] };
    }
    if (dbType === 'mssql') {
      const hostM = url.match(/jdbc:sqlserver:\/\/([^:;]+)(?::(\d+))?/i);
      const dbM = url.match(/databaseName=([^;]+)/i);
      if (hostM) return { host: hostM[1], port: hostM[2] ? parseInt(hostM[2]) : 1433, database: dbM?.[1] ?? '' };
    }
    if (dbType === 'oracle') {
      const m1 = url.match(/jdbc:oracle:thin:@\/\/([^:/]+):(\d+)\/([^?;]+)/i);
      if (m1) return { host: m1[1], port: parseInt(m1[2]), database: m1[3] };
      const m2 = url.match(/jdbc:oracle:thin:@([^:/]+):(\d+):([^?;]+)/i);
      if (m2) return { host: m2[1], port: parseInt(m2[2]), database: m2[3] };
    }
    if (dbType === 'tibero') {
      const m = url.match(/jdbc:tibero:thin:@([^:]+):(\d+):([^?;]+)/i);
      if (m) return { host: m[1], port: parseInt(m[2]), database: m[3] };
    }
  } catch {
    // ignore
  }
  return null;
}

export function detectOs(agentHome: string): 'windows' | 'linux' {
  const winBin = path.resolve(agentHome, 'bin_win');
  const linuxBin = path.resolve(agentHome, 'bin_linux');
  if (fs.existsSync(winBin)) return 'windows';
  if (fs.existsSync(linuxBin)) return 'linux';
  // fallback: 현재 플랫폼 기준
  return process.platform === 'win32' ? 'windows' : 'linux';
}
