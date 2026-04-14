package com.wisecan.unified.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@Slf4j
public class TokenBlacklistService {

    private static final String KEY_PREFIX = "auth:blacklist:";

    @Nullable
    private final StringRedisTemplate redisTemplate;

    public TokenBlacklistService(@Autowired(required = false) @Nullable StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void blacklist(String token, long ttlMillis) {
        if (redisTemplate == null || token == null || token.isBlank() || ttlMillis <= 0) {
            return;
        }
        try {
            redisTemplate.opsForValue().set(KEY_PREFIX + token, "1", Duration.ofMillis(ttlMillis));
        } catch (Exception e) {
            log.warn("Failed to blacklist token: {}", e.getMessage());
        }
    }

    public boolean isBlacklisted(String token) {
        if (redisTemplate == null || token == null || token.isBlank()) {
            return false;
        }
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(KEY_PREFIX + token));
        } catch (Exception e) {
            log.warn("Failed to check token blacklist: {}", e.getMessage());
            return false;
        }
    }
}
