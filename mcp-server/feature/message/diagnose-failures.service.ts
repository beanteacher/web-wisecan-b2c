import {
  prisma, KST_OFFSET_MS, parseDateFilter, todayStartKst,
  VALID_MSG_TYPES, MsgType, resolveChannelFilter,
  buildWhereSql, resolveLogTables, buildLogUnionSql,
  RESULT_CODE_MAP,
} from './shared';
import { MessageDto } from './dto';

export type MessageDiagnoseFailuresInput = MessageDto.MessageDiagnoseFailuresInput;

export async function messageDiagnoseFailures(input: MessageDiagnoseFailuresInput): Promise<string> {
  const dateFrom = parseDateFilter(input.dateFrom) ?? todayStartKst();
  const dateTo = parseDateFilter(input.dateTo) ?? new Date(Date.now() + KST_OFFSET_MS);
  const { channels, subTypeFilter } = resolveChannelFilter(input.msgType);
  const logTables = await resolveLogTables(channels, dateFrom, dateTo);

  const failWhere = buildWhereSql({ dateFrom, dateTo, messageState: 3, subTypeFilter });
  const allWhere = buildWhereSql({ dateFrom, dateTo, subTypeFilter });

  const failUnion = buildLogUnionSql(logTables, 'create_date, result_code, result_net_id', failWhere);
  const allUnion = buildLogUnionSql(logTables, 'msg_id', allWhere);

  const totalCountSql = `SELECT COUNT(*) as total FROM (${allUnion.fragment}) t`;
  const failCountSql = `SELECT COUNT(*) as total FROM (${failUnion.fragment}) t`;
  const hourlySql = `SELECT HOUR(create_date) as h, COUNT(*) as cnt FROM (${failUnion.fragment}) t GROUP BY h ORDER BY h`;
  const codeSql = `SELECT result_code, COUNT(*) as cnt FROM (${failUnion.fragment}) t GROUP BY result_code ORDER BY cnt DESC LIMIT 10`;
  const netSql = `SELECT result_net_id, COUNT(*) as cnt FROM (${failUnion.fragment}) t WHERE result_net_id IS NOT NULL GROUP BY result_net_id ORDER BY cnt DESC LIMIT 10`;

  const [totalResult, failResult, hourlyResult, codeResult, netResult] = await Promise.all([
    prisma.$queryRawUnsafe<{ total: bigint }[]>(totalCountSql, ...allUnion.params),
    prisma.$queryRawUnsafe<{ total: bigint }[]>(failCountSql, ...failUnion.params),
    prisma.$queryRawUnsafe<{ h: number; cnt: bigint }[]>(hourlySql, ...failUnion.params),
    prisma.$queryRawUnsafe<{ result_code: string | null; cnt: bigint }[]>(codeSql, ...failUnion.params),
    prisma.$queryRawUnsafe<{ result_net_id: string | null; cnt: bigint }[]>(netSql, ...failUnion.params),
  ]);

  const totalAll = Number(totalResult[0].total);
  const totalFail = Number(failResult[0].total);
  const failRate = totalAll > 0 ? Math.round(totalFail / totalAll * 1000) / 10 : 0;

  const hourly = hourlyResult.map(r => ({ hour: r.h, count: Number(r.cnt) }));
  const byCode = codeResult.map(r => ({ resultCode: r.result_code ?? '(없음)', count: Number(r.cnt) }));
  const byNet = netResult.map(r => ({ resultNetId: r.result_net_id ?? '(없음)', count: Number(r.cnt) }));

  const diagnoses: string[] = [];

  if (totalFail === 0) {
    return [
      `실패 진단 결과`,
      `전체: ${totalAll}건 | 실패: 0건 | 실패율: 0%`,
      '',
      '진단:',
      '  • 분석 기간 내 실패 건이 없습니다.',
    ].join('\n');
  }

  if (hourly.length > 0) {
    const maxHour = hourly.reduce((a, b) => b.count > a.count ? b : a);
    if (maxHour.count / totalFail >= 0.8) {
      diagnoses.push(`${maxHour.hour}시에 실패의 ${Math.round(maxHour.count / totalFail * 100)}%가 집중 → 해당 시간대 일시 장애 추정`);
    }
  }

  if (byCode.length > 0) {
    const topCode = byCode[0];
    if (topCode.count / totalFail >= 0.8) {
      const info = RESULT_CODE_MAP[topCode.resultCode];
      const desc = info ? info.description : topCode.resultCode;
      diagnoses.push(`결과코드 ${topCode.resultCode}(${desc})이 실패의 ${Math.round(topCode.count / totalFail * 100)}%를 차지 → 특정 원인에 의한 집중 실패`);
      if (topCode.resultCode.startsWith('5')) {
        diagnoses.push(`시스템 오류 계열 코드 집중 → 릴레이/통신사 연동 장애 가능성`);
      } else if (topCode.resultCode === '4100' || topCode.resultCode === '4200') {
        diagnoses.push(`수신 거부/결번 집중 → 수신번호 데이터 품질 점검 필요`);
      }
    }
  }

  if (byNet.length > 0) {
    const topNet = byNet[0];
    if (topNet.count / totalFail >= 0.8 && topNet.resultNetId !== '(없음)') {
      diagnoses.push(`통신사 ${topNet.resultNetId}에서 실패의 ${Math.round(topNet.count / totalFail * 100)}%가 발생 → 해당 통신사 측 이슈 추정`);
    }
  }

  if (diagnoses.length === 0) {
    diagnoses.push('특정 패턴이 감지되지 않았습니다. 실패가 여러 원인에 분산되어 있습니다.');
  }

  return [
    `실패 진단 결과`,
    `전체: ${totalAll}건 | 실패: ${totalFail}건 | 실패율: ${failRate}%`,
    '',
    '시간대별 실패 분포:',
    ...hourly.map(h => `  ${h.hour}시: ${h.count}건`),
    '',
    '결과코드별 분포 (상위):',
    ...byCode.map(c => `  ${c.resultCode}: ${c.count}건`),
    '',
    '통신사별 분포:',
    ...byNet.map(n => `  ${n.resultNetId}: ${n.count}건`),
    '',
    '진단:',
    ...diagnoses.map(d => `  • ${d}`),
  ].join('\n');
}
