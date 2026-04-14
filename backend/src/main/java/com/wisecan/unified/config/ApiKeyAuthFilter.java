package com.wisecan.unified.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wisecan.unified.common.security.ApiKeyPrincipal;
import com.wisecan.unified.domain.ApiKey;
import com.wisecan.unified.domain.ApiKeyStatus;
import com.wisecan.unified.dto.ApiResponse;
import com.wisecan.unified.repository.ApiKeyRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.Nullable;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * X-API-Key 헤더 기반 인증 필터.
 * SHA-256 해시 → ApiKeyRepository 조회 → 상태 검증 → SecurityContext 인증 주입.
 * Redis 또는 in-memory 기반 분당 Rate Limiting 지원.
 * SecurityConfig에서 /mcp/** 경로에만 수동 등록됨 (@Component 미사용).
 */
@Slf4j
public class ApiKeyAuthFilter extends OncePerRequestFilter {

    private static final String API_KEY_HEADER = "X-API-Key";
    private static final String RATE_KEY_PREFIX = "rate:apikey:";

    private final ApiKeyRepository apiKeyRepository;
    private final ObjectMapper objectMapper;
    private final int rateLimitPerMinute;
    private final String rateLimitMode;

    @Nullable
    private final StringRedisTemplate redisTemplate;

    // in-memory fallback: keyHash -> [epochMinute, count]
    private final ConcurrentHashMap<String, long[]> memoryRateStore = new ConcurrentHashMap<>();

    public ApiKeyAuthFilter(ApiKeyRepository apiKeyRepository,
                            ObjectMapper objectMapper,
                            int rateLimitPerMinute,
                            String rateLimitMode,
                            @Nullable StringRedisTemplate redisTemplate) {
        this.apiKeyRepository = apiKeyRepository;
        this.objectMapper = objectMapper;
        this.rateLimitPerMinute = rateLimitPerMinute;
        this.rateLimitMode = rateLimitMode;
        this.redisTemplate = redisTemplate;
    }

    /**
     * /mcp/** 경로에만 이 필터를 적용한다.
     * SecurityConfig 에는 filter chain 한 개로 등록되므로 모든 요청이 이 필터를 통과한다.
     * 따라서 여기서 경로 스코프를 명시적으로 제한해야 /auth/**, /api-keys/** 등이 401 로 차단되지 않는다.
     */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path == null || !path.startsWith("/mcp/") && !path.equals("/mcp");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String rawKey = request.getHeader(API_KEY_HEADER);

        if (!StringUtils.hasText(rawKey)) {
            sendError(response, HttpStatus.UNAUTHORIZED, "API Key가 필요합니다");
            return;
        }

        String keyHash = sha256Hex(rawKey);
        Optional<ApiKey> apiKeyOpt = apiKeyRepository.findByKeyHash(keyHash);

        if (apiKeyOpt.isEmpty()) {
            sendError(response, HttpStatus.UNAUTHORIZED, "유효하지 않은 API Key입니다");
            return;
        }

        ApiKey apiKey = apiKeyOpt.get();

        if (apiKey.getStatus() == ApiKeyStatus.REVOKED) {
            sendError(response, HttpStatus.UNAUTHORIZED, "폐기된 API Key입니다");
            return;
        }

        // Rate Limiting
        if (!checkRateLimit(keyHash)) {
            sendError(response, HttpStatus.TOO_MANY_REQUESTS,
                "API 요청 한도를 초과했습니다 (분당 " + rateLimitPerMinute + "회)");
            return;
        }

        // SecurityContext에 ApiKeyPrincipal 주입
        ApiKeyPrincipal principal = new ApiKeyPrincipal(
            apiKey.getId(),
            apiKey.getMember().getId(),
            Set.of("message:*")
        );
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
            principal,
            null,
            List.of(new SimpleGrantedAuthority("ROLE_API_USER"))
        );
        SecurityContextHolder.getContext().setAuthentication(auth);

        filterChain.doFilter(request, response);
    }

    private boolean checkRateLimit(String keyHash) {
        if ("memory".equalsIgnoreCase(rateLimitMode) || redisTemplate == null) {
            return checkRateLimitMemory(keyHash);
        }
        return checkRateLimitRedis(keyHash);
    }

    private boolean checkRateLimitRedis(String keyHash) {
        long epochMinute = Instant.now().getEpochSecond() / 60;
        String redisKey = RATE_KEY_PREFIX + keyHash + ":" + epochMinute;

        Long count = redisTemplate.opsForValue().increment(redisKey);
        if (count != null && count == 1L) {
            redisTemplate.expire(redisKey, 90, TimeUnit.SECONDS);
        }
        return count != null && count <= rateLimitPerMinute;
    }

    private boolean checkRateLimitMemory(String keyHash) {
        long epochMinute = Instant.now().getEpochSecond() / 60;
        long[] slot = memoryRateStore.compute(keyHash, (k, existing) -> {
            if (existing == null || existing[0] != epochMinute) {
                return new long[]{epochMinute, 1L};
            }
            existing[1]++;
            return existing;
        });
        return slot[1] <= rateLimitPerMinute;
    }

    private String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 알고리즘을 사용할 수 없습니다", e);
        }
    }

    private void sendError(HttpServletResponse response, HttpStatus status, String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        ApiResponse<Void> body = ApiResponse.error(message);
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
