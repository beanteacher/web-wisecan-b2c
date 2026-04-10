# MCP Server

업무 자동화를 위한 MCP(Model Context Protocol) 서버.
Claude 등 AI 에이전트가 메시지 발송·조회·통계 도구를 직접 호출할 수 있도록 지원한다.

---

## 구현된 MCP 도구

### 메시지 발송
| 도구 | 설명 |
|------|------|
| `message_send` | 채널별 tran 테이블에 메시지 전송 요청 적재 (SMS/MMS/KKO/RCS) |
| `message_get_result` | msgId와 발송일로 발송 결과 단건 조회 |
| `message_search` | 다중 조건 발송 결과 검색 (날짜/수신번호/채널/상태 + 페이징) |
| `message_find_failures` | 실패 건 필터링 조회 + resultCode별 건수 요약 |
| `message_result_code_explain` | 통신사 결과코드를 사람이 읽을 수 있는 사유로 해석 |
| `message_check_pending` | 대기/처리중 상태 건수 채널별 조회 + 장기 체류 경고 |
| `message_retry` | 실패 건 재발송 대기열 복귀 (msgIds 또는 조건 지정) |
| `message_cancel` | 미발송(대기) 상태 건 취소 (msgIds 또는 groupId 지정) |
| `message_stat_summary` | 기간별 발송 통계 집계 (채널별/시간대별/일별 groupBy) |
| `message_diagnose_failures` | 실패 건 패턴 분석 및 추정 원인 자동 진단 |
| `message_daily_report` | 특정 일자 발송 종합 리포트 생성 |
| `message_weekly_report` | 주간 발송 리포트 (7일 추이, 전주 대비 증감률) |
| `message_channel_breakdown` | 채널별 세부유형 분해 통계 |
| `message_delivery_time_stats` | 수신 소요시간 분포 히스토그램 |
| `message_trend_compare` | 두 기간 발송 통계 비교 |

---

## 실행

```bash
# 개발 (tsx로 직접 실행)
npx tsx mcp-stdio.ts
```

## 프로젝트 구조

```
mcp-stdio.ts          # 서버 진입점 (stdio transport)
mcp/
├── registry.ts       # 모듈 등록 및 도구 라우팅
├── types.ts          # 공통 타입 정의
├── utils.ts          # 파라미터 파싱 유틸
└── tools/
    └── message.ts    # 메시지 발송 도구
feature/
└── message/          # 메시지 발송·조회·통계
    ├── dto.ts
    ├── shared.ts
    ├── send.service.ts
    ├── get-result.service.ts
    ├── search.service.ts
    └── ... (15개 서비스)
lib/
└── prisma.ts         # Prisma 클라이언트
prisma/
└── schema.prisma     # DB 스키마
```
