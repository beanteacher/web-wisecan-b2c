import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { insertSample } from './insert-sample.service';

// Mock dynamic imports
vi.mock('mysql2/promise', () => ({
  createConnection: vi.fn(),
}));

vi.mock('mssql', () => ({
  connect: vi.fn(),
  VarChar: vi.fn((n: number) => `VarChar(${n})`),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'insertsample-test-'));
}

interface FixtureOpts {
  agentConf?: string[];
  jdbcConf?: string[];
}

function writeFixtures(tmpDir: string, opts: FixtureOpts = {}): void {
  const confDir = path.join(tmpDir, 'conf');
  // bin_win must exist so detectOs picks 'windows' consistently
  fs.mkdirSync(path.join(tmpDir, 'bin_win'), { recursive: true });
  fs.mkdirSync(confDir, { recursive: true });

  fs.writeFileSync(
    path.join(confDir, 'agent.conf'),
    (
      opts.agentConf ?? [
        'agent.sms.use=Y',
        'agent.mms.use=Y',
        'agent.kko.use=Y',
        'agent.send.table.sms=SMS_TRAN',
        'agent.send.table.mms=MMS_TRAN',
        'agent.send.table.kko=KKO_TRAN',
      ]
    ).join('\n'),
  );

  fs.writeFileSync(
    path.join(confDir, 'jdbc.conf'),
    (
      opts.jdbcConf ?? [
        'jdbc.driver=com.mysql.cj.jdbc.Driver',
        'jdbc.url=jdbc:mysql://localhost:3306/testdb',
        'jdbc.username=root',
        'jdbc.password=secret',
      ]
    ).join('\n'),
  );
}

function makeRequestMock(pks: number[]) {
  let callIdx = 0;
  const requestMock = {
    input: vi.fn().mockReturnThis(),
    query: vi.fn().mockImplementation(async () => ({
      recordset: [{ id: pks[callIdx++] ?? 0 }],
    })),
  };
  return requestMock;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('insertSample', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    vi.resetAllMocks();
  });

  it('mysql SMS 테이블에 단건 삽입 후 PK 목록을 반환', async () => {
    writeFixtures(tmpDir);

    const mysql = await import('mysql2/promise');
    const mockConn = {
      execute: vi.fn().mockResolvedValue([{ insertId: 42 }]),
      end: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(mysql.createConnection).mockResolvedValue(mockConn as any);

    const result = await insertSample(tmpDir, { messageType: 'sms', count: 1 });

    expect(result.tableName).toBe('SMS_TRAN');
    expect(result.insertedCount).toBe(1);
    expect(result.insertedPks).toEqual([42]);
    expect(mockConn.end).toHaveBeenCalledOnce();
  });

  it('mysql count 3 요청 시 3건의 PK 목록을 반환', async () => {
    writeFixtures(tmpDir);

    const mysql = await import('mysql2/promise');
    let callCount = 0;
    const mockConn = {
      execute: vi.fn().mockImplementation(async () => [{ insertId: 100 + callCount++ }]),
      end: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(mysql.createConnection).mockResolvedValue(mockConn as any);

    const result = await insertSample(tmpDir, { count: 3 });

    expect(result.insertedCount).toBe(3);
    expect(result.insertedPks).toHaveLength(3);
  });

  it('count 가 10 초과이면 10건으로 제한', async () => {
    writeFixtures(tmpDir);

    const mysql = await import('mysql2/promise');
    let callCount = 0;
    const mockConn = {
      execute: vi.fn().mockImplementation(async () => [{ insertId: callCount++ }]),
      end: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(mysql.createConnection).mockResolvedValue(mockConn as any);

    const result = await insertSample(tmpDir, { count: 99 });

    expect(result.insertedCount).toBe(10);
    expect(mockConn.execute).toHaveBeenCalledTimes(10);
  });

  it('mssql MMS 테이블에 2건 삽입 후 PK 목록을 반환', async () => {
    writeFixtures(tmpDir, {
      jdbcConf: [
        'jdbc.driver=com.microsoft.sqlserver.jdbc.SQLServerDriver',
        'jdbc.url=jdbc:sqlserver://sqlhost:1433;databaseName=mydb',
        'jdbc.username=sa',
        'jdbc.password=SqlPass1!',
      ],
    });

    const mssql = await import('mssql');
    const requestMock = makeRequestMock([201, 202]);
    const mockPool = {
      request: vi.fn().mockReturnValue(requestMock),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(mssql.connect).mockResolvedValue(mockPool as any);

    const result = await insertSample(tmpDir, { messageType: 'mms', count: 2 });

    expect(result.tableName).toBe('MMS_TRAN');
    expect(result.insertedCount).toBe(2);
    expect(result.insertedPks).toEqual([201, 202]);
    expect(mockPool.close).toHaveBeenCalledOnce();
  });

  it('mssql KKO 테이블에 단건 삽입 성공', async () => {
    writeFixtures(tmpDir, {
      jdbcConf: [
        'jdbc.driver=com.microsoft.sqlserver.jdbc.SQLServerDriver',
        'jdbc.url=jdbc:sqlserver://sqlhost:1433;databaseName=mydb',
        'jdbc.username=sa',
        'jdbc.password=pass',
      ],
    });

    const mssql = await import('mssql');
    const requestMock = makeRequestMock([301]);
    const mockPool = {
      request: vi.fn().mockReturnValue(requestMock),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(mssql.connect).mockResolvedValue(mockPool as any);

    const result = await insertSample(tmpDir, { messageType: 'kko', count: 1 });

    expect(result.tableName).toBe('KKO_TRAN');
    expect(result.insertedPks).toEqual([301]);
  });

  it('지원하지 않는 dbType 이면 에러를 던짐', async () => {
    writeFixtures(tmpDir, {
      jdbcConf: [
        'jdbc.driver=oracle.jdbc.OracleDriver',
        'jdbc.url=jdbc:oracle:thin:@//orahost:1521/ORCL',
        'jdbc.username=ora',
        'jdbc.password=ora',
      ],
    });

    await expect(insertSample(tmpDir, { messageType: 'sms' })).rejects.toThrow(
      /MySQL\/MariaDB\/MSSQL만 지원/,
    );
  });

  it('agent.conf에 테이블명이 없으면 에러를 던짐', async () => {
    writeFixtures(tmpDir, {
      agentConf: [
        'agent.sms.use=Y',
        // sendTableSms 누락
      ],
    });

    await expect(insertSample(tmpDir, { messageType: 'sms' })).rejects.toThrow(
      /테이블명이 설정되지 않았습니다/,
    );
  });

  it('mysql 삽입 중 오류 발생 시 conn.end 가 여전히 호출됨 (finally 보장)', async () => {
    writeFixtures(tmpDir);

    const mysql = await import('mysql2/promise');
    const mockConn = {
      execute: vi.fn().mockRejectedValue(new Error('Table does not exist')),
      end: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(mysql.createConnection).mockResolvedValue(mockConn as any);

    await expect(insertSample(tmpDir, { messageType: 'sms' })).rejects.toThrow(
      'Table does not exist',
    );
    expect(mockConn.end).toHaveBeenCalledOnce();
  });

  it('mssql 삽입 중 오류 발생 시 pool.close 가 여전히 호출됨 (finally 보장)', async () => {
    writeFixtures(tmpDir, {
      jdbcConf: [
        'jdbc.driver=com.microsoft.sqlserver.jdbc.SQLServerDriver',
        'jdbc.url=jdbc:sqlserver://sqlhost:1433;databaseName=mydb',
        'jdbc.username=sa',
        'jdbc.password=pass',
      ],
    });

    const mssql = await import('mssql');
    const requestMock = {
      input: vi.fn().mockReturnThis(),
      query: vi.fn().mockRejectedValue(new Error('Invalid object name')),
    };
    const mockPool = {
      request: vi.fn().mockReturnValue(requestMock),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(mssql.connect).mockResolvedValue(mockPool as any);

    await expect(insertSample(tmpDir, { messageType: 'sms' })).rejects.toThrow(
      'Invalid object name',
    );
    expect(mockPool.close).toHaveBeenCalledOnce();
  });

  it('mms 테이블명이 없으면 sms 테이블로 폴백', async () => {
    writeFixtures(tmpDir, {
      agentConf: [
        'agent.sms.use=Y',
        'agent.mms.use=Y',
        'agent.send.table.sms=SMS_TRAN',
        // sendTableMms 누락 → sms 테이블 폴백
      ],
    });

    const mysql = await import('mysql2/promise');
    const mockConn = {
      execute: vi.fn().mockResolvedValue([{ insertId: 1 }]),
      end: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(mysql.createConnection).mockResolvedValue(mockConn as any);

    const result = await insertSample(tmpDir, { messageType: 'mms', count: 1 });

    expect(result.tableName).toBe('SMS_TRAN');
  });
});
