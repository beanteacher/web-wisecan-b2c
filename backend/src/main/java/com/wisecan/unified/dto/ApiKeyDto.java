package com.wisecan.unified.dto;

import com.wisecan.unified.domain.ApiKey;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public class ApiKeyDto {

    public record CreateRequest(
        @NotBlank(message = "키 이름은 필수입니다")
        @Size(max = 100, message = "키 이름은 100자 이하여야 합니다")
        String keyName
    ) {}

    public record Response(
        Long id,
        String keyName,
        String keyPrefix,
        String status,
        LocalDateTime lastUsedAt,
        LocalDateTime createdAt
    ) {
        public static Response from(ApiKey apiKey) {
            return new Response(
                apiKey.getId(),
                apiKey.getKeyName(),
                apiKey.getKeyPrefix(),
                apiKey.getStatus().name(),
                apiKey.getLastUsedAt(),
                apiKey.getCreatedAt()
            );
        }
    }

    public record CreateResponse(
        Long id,
        String keyName,
        String keyPrefix,
        String rawKey,
        String status,
        LocalDateTime createdAt
    ) {}
}
