import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseJdbcConf } from './jdbc-conf.parser';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-test-'));
}

describe('parseJdbcConf', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('conf/jdbc.conf가 없으면 dbType=unknown 반환', async () => {
    const result = await parseJdbcConf(tmpDir);
    expect(result).toEqual({ dbType: 'unknown' });
  });

  it('MySQL 드라이버를 인식', async () => {
    const confDir = path.join(tmpDir, 'conf');
    fs.mkdirSync(confDir, { recursive: true });
    fs.writeFileSync(
      path.join(confDir, 'jdbc.conf'),
      [
        'jdbc.driver=com.mysql.cj.jdbc.Driver',
        'jdbc.url=jdbc:mysql://localhost:3306/testdb',
        'jdbc.username=root',
        'jdbc.password=secret123',
      ].join('\n'),
    );

    const result = await parseJdbcConf(tmpDir);
    expect(result.dbType).toBe('mysql');
    expect(result.driver).toBe('com.mysql.cj.jdbc.Driver');
    expect(result.url).toBe('jdbc:mysql://localhost:3306/testdb');
    expect(result.username).toBe('root');
    expect(result.password).toBe('secret123');
  });

  it('MariaDB 드라이버를 인식', async () => {
    const confDir = path.join(tmpDir, 'conf');
    fs.mkdirSync(confDir, { recursive: true });
    fs.writeFileSync(
      path.join(confDir, 'jdbc.conf'),
      'jdbc.driver=org.mariadb.jdbc.Driver\n',
    );

    const result = await parseJdbcConf(tmpDir);
    expect(result.dbType).toBe('mariadb');
  });

  it('Oracle 드라이버를 인식', async () => {
    const confDir = path.join(tmpDir, 'conf');
    fs.mkdirSync(confDir, { recursive: true });
    fs.writeFileSync(
      path.join(confDir, 'jdbc.conf'),
      'jdbc.driver=oracle.jdbc.OracleDriver\n',
    );

    const result = await parseJdbcConf(tmpDir);
    expect(result.dbType).toBe('oracle');
  });

  it('MSSQL 드라이버를 인식', async () => {
    const confDir = path.join(tmpDir, 'conf');
    fs.mkdirSync(confDir, { recursive: true });
    fs.writeFileSync(
      path.join(confDir, 'jdbc.conf'),
      'jdbc.driver=com.microsoft.sqlserver.jdbc.SQLServerDriver\n',
    );

    const result = await parseJdbcConf(tmpDir);
    expect(result.dbType).toBe('mssql');
  });

  it('Tibero 드라이버를 인식', async () => {
    const confDir = path.join(tmpDir, 'conf');
    fs.mkdirSync(confDir, { recursive: true });
    fs.writeFileSync(
      path.join(confDir, 'jdbc.conf'),
      'jdbc.driver=com.tmax.tibero.jdbc.TbDriver\n',
    );

    const result = await parseJdbcConf(tmpDir);
    expect(result.dbType).toBe('tibero');
  });

  it('알 수 없는 드라이버는 unknown 반환', async () => {
    const confDir = path.join(tmpDir, 'conf');
    fs.mkdirSync(confDir, { recursive: true });
    fs.writeFileSync(
      path.join(confDir, 'jdbc.conf'),
      'jdbc.driver=some.random.Driver\n',
    );

    const result = await parseJdbcConf(tmpDir);
    expect(result.dbType).toBe('unknown');
  });

  it('mybatis.mapper.location을 파싱', async () => {
    const confDir = path.join(tmpDir, 'conf');
    fs.mkdirSync(confDir, { recursive: true });
    fs.writeFileSync(
      path.join(confDir, 'jdbc.conf'),
      [
        'jdbc.driver=com.mysql.cj.jdbc.Driver',
        'mybatis.mapper.location=../conf/mapper.xml',
      ].join('\n'),
    );

    const result = await parseJdbcConf(tmpDir);
    expect(result.mapperLocation).toBe('../conf/mapper.xml');
  });
});
