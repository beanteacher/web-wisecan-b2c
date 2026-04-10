import * as fs from 'fs';
import * as path from 'path';
import { AgentDto } from './dto';
import { analyzeConfig } from './analyze-config.service';
import { analyzeLogs } from './analyze-logs.service';

export async function diagnose(
  agentHome: string,
  os?: 'windows' | 'linux',
): Promise<AgentDto.DiagnoseResult> {
  const [config, logResult] = await Promise.all([
    analyzeConfig(agentHome, os),
    analyzeLogs(agentHome),
  ]);

  const issues: AgentDto.DiagnoseIssue[] = [];
  const summary = logResult.summary;

  // 로그 기반 진단
  if (summary['DB_CONNECTION_FAILED']) {
    issues.push({
      severity: 'ERROR',
      category: 'DB_CONNECTION_FAILED',
      message: `DB 연결 실패 ${summary['DB_CONNECTION_FAILED']}건 감지. jdbc.conf URL/포트 확인 필요${config.jdbcConf.url ? ` (현재: ${config.jdbcConf.url})` : ''}`,
    });
  }

  if (summary['TABLE_NOT_FOUND']) {
    const tables = [
      config.agentConf.sendTableSms,
      config.agentConf.sendTableMms,
      config.agentConf.sendTableKko,
    ]
      .filter(Boolean)
      .join(', ');
    issues.push({
      severity: 'ERROR',
      category: 'TABLE_NOT_FOUND',
      message: `테이블 없음 ${summary['TABLE_NOT_FOUND']}건 감지. sendTable 설정 확인 필요${tables ? ` (현재: ${tables})` : ''}`,
    });
  }

  if (summary['RELAY_CONNECTION_FAILED']) {
    const relayInfo = [
      config.agentConf.relaySmsIp &&
        `SMS릴레이 ${config.agentConf.relaySmsIp}:${config.agentConf.relaySmsPort}`,
      config.agentConf.relayMmsIp &&
        `MMS릴레이 ${config.agentConf.relayMmsIp}:${config.agentConf.relayMmsPort}`,
    ]
      .filter(Boolean)
      .join(', ');
    issues.push({
      severity: 'ERROR',
      category: 'RELAY_CONNECTION_FAILED',
      message: `릴레이 연결 실패 ${summary['RELAY_CONNECTION_FAILED']}건 감지. 릴레이 서버 접속 확인 필요${relayInfo ? ` (${relayInfo})` : ''}`,
    });
  }

  if (summary['JVM_MEMORY']) {
    issues.push({
      severity: 'ERROR',
      category: 'JVM_MEMORY',
      message: `JVM 메모리 부족 ${summary['JVM_MEMORY']}건 감지. jvmOpts -Xmx 값 증가 필요${config.setting.jvmOpts ? ` (현재: ${config.setting.jvmOpts})` : ''}`,
    });
  }

  if (summary['CLASSPATH_ERROR']) {
    issues.push({
      severity: 'ERROR',
      category: 'CLASSPATH_ERROR',
      message: `클래스 로드 실패 ${summary['CLASSPATH_ERROR']}건 감지. JAR_PATH 또는 SERVICE_START_CLASS 설정 확인 필요${config.setting.jarPath ? ` (현재 JAR_PATH: ${config.setting.jarPath})` : ''}`,
    });
  }

  // 설정 기반 진단
  if (config.activeMessageTypes.length === 0) {
    issues.push({
      severity: 'WARN',
      category: 'NO_ACTIVE_MESSAGE_TYPE',
      message:
        'SMS/LMS/MMS/KKO 중 활성화된 메시지 타입이 없습니다. agent.conf의 smsUse/lmsUse/mmsUse/kkoUse 확인 필요',
    });
  }

  if (!config.setting.javaHome) {
    issues.push({
      severity: 'WARN',
      category: 'JAVA_HOME_MISSING',
      message: 'JAVA_HOME이 설정되지 않았습니다. setting 파일 확인 필요',
    });
  }

  if (config.jdbcConf.dbType === 'unknown') {
    issues.push({
      severity: 'WARN',
      category: 'UNKNOWN_DB_TYPE',
      message: 'DB 타입을 인식할 수 없습니다. jdbc.conf의 driver/url 확인 필요',
    });
  }

  // 파일 존재 검증
  const resolvedHome = path.resolve(agentHome);

  // 1. java 실행 파일 존재 여부
  if (config.setting.javaHome) {
    const javaHome = config.setting.javaHome.replace(/"/g, '');
    const javaExe = config.os === 'windows'
      ? path.join(javaHome, 'bin', 'java.exe')
      : path.join(javaHome, 'bin', 'java');
    if (!fs.existsSync(javaExe)) {
      issues.push({
        severity: 'ERROR',
        category: 'JAVA_EXECUTABLE_NOT_FOUND',
        message: `java 실행 파일이 존재하지 않습니다: ${javaExe}`,
      });
    }
  }

  // 2. JAR 파일 존재 여부
  if (config.setting.jarPath) {
    const missingJars = config.setting.jarPath
      .split(';')
      .map((p) => p.replace(/"/g, '').trim())
      .filter((p) => p.endsWith('.jar'))
      .filter((p) => !fs.existsSync(p));
    for (const jar of missingJars) {
      issues.push({
        severity: 'ERROR',
        category: 'JAR_NOT_FOUND',
        message: `JAR 파일이 존재하지 않습니다: ${jar}`,
      });
    }
  }

  // 3. mapper XML 존재 여부
  if (config.jdbcConf.mapperLocation) {
    const mapperPath = path.resolve(resolvedHome, config.jdbcConf.mapperLocation.replace(/^\.\.\//, ''));
    if (!fs.existsSync(mapperPath)) {
      issues.push({
        severity: 'ERROR',
        category: 'MAPPER_NOT_FOUND',
        message: `mapper XML 파일이 존재하지 않습니다: ${mapperPath}`,
      });
    }
  }

  return {
    config,
    logSummary: summary,
    issues,
    healthy: issues.every((i) => i.severity !== 'ERROR'),
  };
}

export function formatDiagnose(result: AgentDto.DiagnoseResult): string {
  return JSON.stringify(result, null, 2);
}
