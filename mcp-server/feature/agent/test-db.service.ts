import * as path from 'path';
import { AgentDto } from './dto';
import { parseJdbcUrl } from './shared';
import { parseJdbcConf } from './parsers/jdbc-conf.parser';

export async function testDb(agentHome: string): Promise<AgentDto.DbTestResult> {
  const jdbcConf = await parseJdbcConf(path.resolve(agentHome));
  const { dbType, url = '', username = '', password = '' } = jdbcConf;
  const connParams = url ? parseJdbcUrl(url, dbType) : null;
  const start = Date.now();

  try {
    if (dbType === 'mysql' || dbType === 'mariadb') {
      const mysql = await import('mysql2/promise');
      const conn = await mysql.createConnection({
        host: connParams?.host,
        port: connParams?.port,
        database: connParams?.database,
        user: username,
        password,
        connectTimeout: 5000,
      });
      await conn.end();
      return { dbType, url, connected: true, elapsedMs: Date.now() - start };
    }

    if (dbType === 'mssql') {
      const mssql = await import('mssql');
      const pool = await mssql.connect({
        server: connParams?.host ?? '',
        port: connParams?.port,
        database: connParams?.database,
        user: username,
        password,
        options: { trustServerCertificate: true },
        connectionTimeout: 5000,
      });
      await pool.close();
      return { dbType, url, connected: true, elapsedMs: Date.now() - start };
    }

    if (dbType === 'oracle') {
      return {
        dbType, url, connected: false, elapsedMs: Date.now() - start,
        error: 'Oracle은 oracledb 설치가 필요합니다. npm install oracledb 후 재시도하세요.',
      };
    }

    if (dbType === 'tibero') {
      return {
        dbType, url, connected: false, elapsedMs: Date.now() - start,
        error: 'Tibero는 Node.js 드라이버가 미지원입니다.',
      };
    }

    return {
      dbType, url, connected: false, elapsedMs: Date.now() - start,
      error: `지원하지 않는 DB 타입: ${dbType}`,
    };
  } catch (e) {
    return {
      dbType, url, connected: false, elapsedMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export function formatTestDb(result: AgentDto.DbTestResult): string {
  return [
    `dbType: ${result.dbType}`,
    `url: ${result.url}`,
    `connected: ${result.connected}`,
    `elapsedMs: ${result.elapsedMs}`,
    ...(result.error ? [`error: ${result.error}`] : []),
  ].join('\n');
}
