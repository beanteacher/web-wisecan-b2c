import * as path from 'path';
import { AgentDto } from './dto';
import { parseJdbcUrl } from './shared';
import { parseAgentConf } from './parsers/agent-conf.parser';
import { parseJdbcConf } from './parsers/jdbc-conf.parser';

export async function insertSample(
  agentHome: string,
  opts?: {
    messageType?: string;
    destaddr?: string;
    sendMsg?: string;
    count?: number;
  },
): Promise<AgentDto.InsertSampleResult> {
  const resolvedHome = path.resolve(agentHome);
  const [agentConf, jdbcConf] = await Promise.all([
    parseAgentConf(resolvedHome),
    parseJdbcConf(resolvedHome),
  ]);

  const messageType = opts?.messageType ?? 'sms';
  const destaddr = opts?.destaddr ?? '01000000000';
  const sendMsg = opts?.sendMsg ?? '[테스트] 샘플 메시지';
  const count = Math.min(opts?.count ?? 1, 10);

  let tableName: string | undefined;
  if (messageType === 'mms') {
    tableName = agentConf.sendTableMms ?? agentConf.sendTableSms;
  } else if (messageType === 'kko') {
    tableName = agentConf.sendTableKko ?? agentConf.sendTableSms;
  } else {
    tableName = agentConf.sendTableSms;
  }

  if (!tableName) {
    throw new Error(`agent.conf에 ${messageType} 테이블명이 설정되지 않았습니다.`);
  }

  const { dbType, url = '', username = '', password = '' } = jdbcConf;
  const connParams = url ? parseJdbcUrl(url, dbType) : null;
  const now = new Date().toISOString().replace('T', ' ').replace(/\..+/, '');
  const insertedPks: number[] = [];

  if (dbType === 'mysql' || dbType === 'mariadb') {
    const mysql = await import('mysql2/promise');
    const conn = await mysql.createConnection({
      host: connParams?.host,
      port: connParams?.port,
      database: connParams?.database,
      user: username,
      password,
    });
    try {
      for (let i = 0; i < count; i++) {
        const [result] = await conn.execute(
          `INSERT INTO ${tableName} (destaddr, sendmsg, stat, reg_date) VALUES (?, ?, 0, ?)`,
          [destaddr, sendMsg, now],
        );
        insertedPks.push((result as { insertId: number }).insertId);
      }
    } finally {
      await conn.end();
    }
  } else if (dbType === 'mssql') {
    const mssql = await import('mssql');
    const pool = await mssql.connect({
      server: connParams?.host ?? '',
      port: connParams?.port,
      database: connParams?.database,
      user: username,
      password,
      options: { trustServerCertificate: true },
    });
    try {
      for (let i = 0; i < count; i++) {
        const result = await pool
          .request()
          .input('destaddr', mssql.VarChar(20), destaddr)
          .input('sendmsg', mssql.VarChar(4000), sendMsg)
          .input('reg_date', mssql.VarChar(20), now)
          .query(
            `INSERT INTO ${tableName} (destaddr, sendmsg, stat, reg_date) VALUES (@destaddr, @sendmsg, 0, @reg_date); SELECT SCOPE_IDENTITY() AS id`,
          );
        insertedPks.push(result.recordset[0]?.id ?? 0);
      }
    } finally {
      await pool.close();
    }
  } else {
    throw new Error(`insertSample은 MySQL/MariaDB/MSSQL만 지원합니다. 현재 DB: ${dbType}`);
  }

  return { tableName, insertedCount: insertedPks.length, insertedPks };
}

export function formatInsertSample(result: AgentDto.InsertSampleResult): string {
  return [
    `tableName: ${result.tableName}`,
    `insertedCount: ${result.insertedCount}`,
    `insertedPks: ${result.insertedPks.join(', ')}`,
  ].join('\n');
}
