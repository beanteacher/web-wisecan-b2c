export namespace AgentDto {
  export interface SettingResult {
    agentHome: string;
    javaHome?: string;
    jarPath?: string;
    jvmOpts?: string;
    serviceStartClass?: string;
  }

  export interface AgentConfResult {
    relaySmsIp?: string;
    relaySmsPort?: string;
    relayMmsIp?: string;
    relayMmsPort?: string;
    smsUse?: string;
    lmsUse?: string;
    mmsUse?: string;
    kkoUse?: string;
    sendTableSms?: string;
    sendTableMms?: string;
    sendTableKko?: string;
    fetchDelay?: string;
    completeDelay?: string;
  }

  export interface JdbcConfResult {
    driver?: string;
    dbType: 'mysql' | 'mariadb' | 'oracle' | 'mssql' | 'tibero' | 'unknown';
    url?: string;
    username?: string;
    password?: string;
    mapperLocation?: string;
  }

  export interface ConfigResult {
    os: 'windows' | 'linux';
    setting: SettingResult;
    agentConf: AgentConfResult;
    jdbcConf: Omit<JdbcConfResult, 'password'> & { password: '****' };
    activeMessageTypes: string[];
  }

  export interface LogEntry {
    file: string;
    level: 'ERROR' | 'WARN';
    line: string;
    category:
      | 'DB_CONNECTION_FAILED'
      | 'TABLE_NOT_FOUND'
      | 'RELAY_CONNECTION_FAILED'
      | 'JVM_MEMORY'
      | 'CLASSPATH_ERROR'
      | 'UNKNOWN';
  }

  export interface LogResult {
    entries: LogEntry[];
    summary: Record<string, number>;
  }

  export interface DiagnoseIssue {
    severity: 'ERROR' | 'WARN' | 'INFO';
    category: string;
    message: string;
  }

  export interface DiagnoseResult {
    config: ConfigResult;
    logSummary: LogResult['summary'];
    issues: DiagnoseIssue[];
    healthy: boolean;
  }

  export interface DbTestResult {
    dbType: JdbcConfResult['dbType'];
    url: string;
    connected: boolean;
    elapsedMs: number;
    error?: string;
  }

  export interface InsertSampleResult {
    tableName: string;
    insertedCount: number;
    insertedPks: number[];
  }
}
