import * as fs from 'fs';
import * as path from 'path';
import { AgentDto } from '@/feature/agent/dto';

type DbType = AgentDto.JdbcConfResult['dbType'];

function detectDbType(driver: string | undefined): DbType {
  if (!driver) return 'unknown';
  if (driver.startsWith('com.mysql.')) return 'mysql';
  if (driver.startsWith('org.mariadb.')) return 'mariadb';
  if (driver.startsWith('oracle.jdbc.')) return 'oracle';
  if (driver.startsWith('com.microsoft.sqlserver.')) return 'mssql';
  if (driver.startsWith('com.tmax.tibero.')) return 'tibero';
  return 'unknown';
}

export async function parseJdbcConf(agentHome: string): Promise<AgentDto.JdbcConfResult> {
  const filePath = path.resolve(agentHome, 'conf', 'jdbc.conf');

  const result: AgentDto.JdbcConfResult = { dbType: 'unknown' };

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return result;
  }

  const props = new Map<string, string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();
    props.set(key, value);
  }

  const driver = props.get('jdbc.driver');
  if (driver !== undefined) result.driver = driver;
  if (props.has('jdbc.url')) result.url = props.get('jdbc.url');
  if (props.has('jdbc.username')) result.username = props.get('jdbc.username');
  if (props.has('jdbc.password')) result.password = props.get('jdbc.password');
  if (props.has('mybatis.mapper.location')) result.mapperLocation = props.get('mybatis.mapper.location');

  result.dbType = detectDbType(driver);

  return result;
}
