import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { testDb } from './test-db.service';

// Mock dynamic imports
vi.mock('mysql2/promise', () => ({
  createConnection: vi.fn(),
}));

vi.mock('mssql', () => ({
  connect: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'testdb-test-'));
}

function writeJdbcConf(tmpDir: string, lines: string[]): void {
  const confDir = path.join(tmpDir, 'conf');
  fs.mkdirSync(confDir, { recursive: true });
  fs.writeFileSync(path.join(confDir, 'jdbc.conf'), lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('testDb', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    vi.resetAllMocks();
  });

  it('mysql 연결 성공 시 connected: true 반환', async () => {
    writeJdbcConf(tmpDir, [
      'jdbc.driver=com.mysql.cj.jdbc.Driver',
      'jdbc.url=jdbc:mysql://localhost:3306/testdb',
      'jdbc.username=root',
      'jdbc.password=secret',
    ]);

    const mysql = await import('mysql2/promise');
    const mockConn = { end: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(mysql.createConnection).mockResolvedValue(mockConn as any);

    const result = await testDb(tmpDir);

    expect(result.connected).toBe(true);
    expect(result.dbType).toBe('mysql');
    expect(result.url).toBe('jdbc:mysql://localhost:3306/testdb');
    expect(result.error).toBeUndefined();
    expect(mockConn.end).toHaveBeenCalledOnce();
  });

  it('mariadb 연결 성공 시 connected: true 반환', async () => {
    writeJdbcConf(tmpDir, [
      'jdbc.driver=org.mariadb.jdbc.Driver',
      'jdbc.url=jdbc:mariadb://db-host:3307/mydb',
      'jdbc.username=admin',
      'jdbc.password=pass',
    ]);

    const mysql = await import('mysql2/promise');
    const mockConn = { end: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(mysql.createConnection).mockResolvedValue(mockConn as any);

    const result = await testDb(tmpDir);

    expect(result.connected).toBe(true);
    expect(result.dbType).toBe('mariadb');
    expect(mockConn.end).toHaveBeenCalledOnce();
  });

  it('mssql 연결 성공 시 connected: true 반환', async () => {
    writeJdbcConf(tmpDir, [
      'jdbc.driver=com.microsoft.sqlserver.jdbc.SQLServerDriver',
      'jdbc.url=jdbc:sqlserver://sqlhost:1433;databaseName=mydb',
      'jdbc.username=sa',
      'jdbc.password=SqlPass1!',
    ]);

    const mssql = await import('mssql');
    const mockPool = { close: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(mssql.connect).mockResolvedValue(mockPool as any);

    const result = await testDb(tmpDir);

    expect(result.connected).toBe(true);
    expect(result.dbType).toBe('mssql');
    expect(result.url).toBe('jdbc:sqlserver://sqlhost:1433;databaseName=mydb');
    expect(result.error).toBeUndefined();
    expect(mockPool.close).toHaveBeenCalledOnce();
  });

  it('oracle 은 oracledb 설치 안내 메시지를 반환', async () => {
    writeJdbcConf(tmpDir, [
      'jdbc.driver=oracle.jdbc.OracleDriver',
      'jdbc.url=jdbc:oracle:thin:@//orahost:1521/ORCL',
      'jdbc.username=ora_user',
      'jdbc.password=ora_pass',
    ]);

    const result = await testDb(tmpDir);

    expect(result.connected).toBe(false);
    expect(result.dbType).toBe('oracle');
    expect(result.error).toContain('oracledb');
    expect(result.error).toContain('npm install');
  });

  it('tibero 는 드라이버 미지원 메시지를 반환', async () => {
    writeJdbcConf(tmpDir, [
      'jdbc.driver=com.tmax.tibero.jdbc.TbDriver',
      'jdbc.url=jdbc:tibero:thin:@tibhost:8629:TIBERODB',
      'jdbc.username=tib_user',
      'jdbc.password=tib_pass',
    ]);

    const result = await testDb(tmpDir);

    expect(result.connected).toBe(false);
    expect(result.dbType).toBe('tibero');
    expect(result.error).toContain('드라이버');
  });

  it('unknown dbType 은 connected: false 와 지원 불가 메시지를 반환', async () => {
    writeJdbcConf(tmpDir, [
      'jdbc.driver=com.unknown.SomeDriver',
      'jdbc.url=jdbc:unknown://host:9999/db',
      'jdbc.username=user',
      'jdbc.password=pass',
    ]);

    const result = await testDb(tmpDir);

    expect(result.connected).toBe(false);
    expect(result.dbType).toBe('unknown');
    expect(result.error).toContain('unknown');
  });

  it('mysql 연결 실패 시 error 메시지를 반환하고 connected: false', async () => {
    writeJdbcConf(tmpDir, [
      'jdbc.driver=com.mysql.cj.jdbc.Driver',
      'jdbc.url=jdbc:mysql://bad-host:3306/db',
      'jdbc.username=root',
      'jdbc.password=wrong',
    ]);

    const mysql = await import('mysql2/promise');
    vi.mocked(mysql.createConnection).mockRejectedValue(new Error('ECONNREFUSED bad-host:3306'));

    const result = await testDb(tmpDir);

    expect(result.connected).toBe(false);
    expect(result.dbType).toBe('mysql');
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('mssql 연결 실패 시 error 메시지를 반환하고 connected: false', async () => {
    writeJdbcConf(tmpDir, [
      'jdbc.driver=com.microsoft.sqlserver.jdbc.SQLServerDriver',
      'jdbc.url=jdbc:sqlserver://bad-host:1433;databaseName=db',
      'jdbc.username=sa',
      'jdbc.password=wrong',
    ]);

    const mssql = await import('mssql');
    vi.mocked(mssql.connect).mockRejectedValue(new Error('Login failed for user'));

    const result = await testDb(tmpDir);

    expect(result.connected).toBe(false);
    expect(result.dbType).toBe('mssql');
    expect(result.error).toContain('Login failed');
  });

  it('elapsedMs 는 0 이상의 숫자를 반환', async () => {
    writeJdbcConf(tmpDir, [
      'jdbc.driver=com.mysql.cj.jdbc.Driver',
      'jdbc.url=jdbc:mysql://localhost:3306/db',
      'jdbc.username=root',
      'jdbc.password=pass',
    ]);

    const mysql = await import('mysql2/promise');
    const mockConn = { end: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(mysql.createConnection).mockResolvedValue(mockConn as any);

    const result = await testDb(tmpDir);

    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.elapsedMs).toBe('number');
  });
});
