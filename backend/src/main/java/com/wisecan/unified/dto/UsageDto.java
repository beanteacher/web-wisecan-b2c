package com.wisecan.unified.dto;

import com.wisecan.unified.domain.ApiUsage;

import java.time.LocalDateTime;

public class UsageDto {

    public record Response(
        Long id,
        String keyName,
        String keyPrefix,
        String toolName,
        String status,
        int responseTimeMs,
        String errorMessage,
        LocalDateTime calledAt
    ) {
        public static Response from(ApiUsage usage) {
            return new Response(
                usage.getId(),
                usage.getApiKey().getKeyName(),
                usage.getApiKey().getKeyPrefix(),
                usage.getToolName(),
                usage.getStatus().name(),
                usage.getResponseTimeMs(),
                usage.getErrorMessage(),
                usage.getCalledAt()
            );
        }
    }

    public record SummaryResponse(
        long totalCalls,
        long successCount,
        long failCount,
        long todayCalls
    ) {}
}
