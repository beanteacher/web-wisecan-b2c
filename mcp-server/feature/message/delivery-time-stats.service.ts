import {
  prisma, KST_OFFSET_MS, parseDateFilter, todayStartKst,
  resolveChannelFilter, buildWhereSql,
  resolveLogTables, buildLogUnionSql,
} from './shared';
import { MessageDto } from './dto';

export type MessageDeliveryTimeStatsInput = MessageDto.MessageDeliveryTimeStatsInput;

const DELIVERY_BUCKETS = [
  { label: '1초 이내' },
  { label: '1~5초' },
  { label: '5~10초' },
  { label: '10~30초' },
  { label: '30~60초' },
  { label: '1~5분' },
  { label: '5분 초과' },
];

export async function messageDeliveryTimeStats(input: MessageDeliveryTimeStatsInput): Promise<string> {
  const dateFrom = parseDateFilter(input.dateFrom) ?? todayStartKst();
  const dateTo = parseDateFilter(input.dateTo) ?? new Date(Date.now() + KST_OFFSET_MS);
  const { channels, subTypeFilter } = resolveChannelFilter(input.msgType);
  const logTables = await resolveLogTables(channels, dateFrom, dateTo);
  const where = buildWhereSql({ dateFrom, dateTo, messageState: 2, subTypeFilter });

  const union = buildLogUnionSql(logTables, 'create_date, result_deliver_date', where);

  const bucketSql = `
    SELECT
      CASE
        WHEN diff_sec <= 1 THEN 0
        WHEN diff_sec <= 5 THEN 1
        WHEN diff_sec <= 10 THEN 2
        WHEN diff_sec <= 30 THEN 3
        WHEN diff_sec <= 60 THEN 4
        WHEN diff_sec <= 300 THEN 5
        ELSE 6
      END as bucket,
      COUNT(*) as cnt
    FROM (
      SELECT TIMESTAMPDIFF(SECOND, create_date, result_deliver_date) as diff_sec
      FROM (${union.fragment}) t
      WHERE result_deliver_date IS NOT NULL
    ) d
    GROUP BY bucket
    ORDER BY bucket
  `;

  const channelStatsSql = `
    SELECT _channel,
      AVG(TIMESTAMPDIFF(SECOND, create_date, result_deliver_date)) as avg_sec,
      MAX(TIMESTAMPDIFF(SECOND, create_date, result_deliver_date)) as max_sec,
      MIN(TIMESTAMPDIFF(SECOND, create_date, result_deliver_date)) as min_sec,
      COUNT(*) as cnt
    FROM (${union.fragment}) t
    WHERE result_deliver_date IS NOT NULL
    GROUP BY _channel
  `;

  const overallSql = `
    SELECT
      AVG(TIMESTAMPDIFF(SECOND, create_date, result_deliver_date)) as avg_sec,
      MAX(TIMESTAMPDIFF(SECOND, create_date, result_deliver_date)) as max_sec,
      MIN(TIMESTAMPDIFF(SECOND, create_date, result_deliver_date)) as min_sec,
      COUNT(*) as cnt
    FROM (${union.fragment}) t
    WHERE result_deliver_date IS NOT NULL
  `;

  const [bucketResult, channelStatsResult, overallResult] = await Promise.all([
    prisma.$queryRawUnsafe<{ bucket: number; cnt: bigint }[]>(bucketSql, ...union.params),
    prisma.$queryRawUnsafe<{ _channel: string; avg_sec: number | null; max_sec: number | null; min_sec: number | null; cnt: bigint }[]>(channelStatsSql, ...union.params),
    prisma.$queryRawUnsafe<{ avg_sec: number | null; max_sec: number | null; min_sec: number | null; cnt: bigint }[]>(overallSql, ...union.params),
  ]);

  const totalWithDelivery = bucketResult.reduce((sum, r) => sum + Number(r.cnt), 0);
  const overall = overallResult[0];

  const lines = [
    `[수신 소요시간 분포]`,
    `측정 대상: ${totalWithDelivery}건 (result_deliver_date가 있는 성공 건)`,
  ];
  if (overall?.avg_sec != null) {
    lines.push(`전체 평균: ${Math.round(overall.avg_sec * 10) / 10}초 | 최소: ${overall.min_sec}초 | 최대: ${overall.max_sec}초`);
  }
  lines.push('', '■ 구간별 분포');
  lines.push('  구간       | 건수   | 비율');
  lines.push('  -----------|--------|------');
  for (let i = 0; i < DELIVERY_BUCKETS.length; i++) {
    const row = bucketResult.find(r => Number(r.bucket) === i);
    const count = row ? Number(row.cnt) : 0;
    const pct = totalWithDelivery > 0 ? Math.round(count / totalWithDelivery * 1000) / 10 : 0;
    const bar = '█'.repeat(Math.max(1, Math.round(pct / 5)));
    lines.push(`  ${DELIVERY_BUCKETS[i].label.padEnd(9)} | ${String(count).padStart(6)} | ${pct}% ${bar}`);
  }
  if (channelStatsResult.length > 0) {
    lines.push('', '■ 채널별 소요시간');
    for (const c of channelStatsResult) {
      const avg = c.avg_sec != null ? Math.round(c.avg_sec * 10) / 10 : '-';
      lines.push(`  ${c._channel}: 평균 ${avg}초 | 최소 ${c.min_sec ?? '-'}초 | 최대 ${c.max_sec ?? '-'}초 (${Number(c.cnt)}건)`);
    }
  }
  return lines.join('\n');
}
