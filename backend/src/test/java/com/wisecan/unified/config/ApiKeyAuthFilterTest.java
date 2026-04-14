package com.wisecan.unified.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wisecan.unified.domain.ApiKey;
import com.wisecan.unified.domain.ApiKeyStatus;
import com.wisecan.unified.domain.Member;
import com.wisecan.unified.domain.MemberRole;
import com.wisecan.unified.domain.MemberStatus;
import com.wisecan.unified.repository.ApiKeyRepository;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ApiKeyAuthFilterTest {

    @Mock
    private ApiKeyRepository apiKeyRepository;

    @Mock
    private FilterChain filterChain;

    private ApiKeyAuthFilter filter;
    private ObjectMapper objectMapper;

    private static final String VALID_KEY = "test-valid-api-key-12345";

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        filter = new ApiKeyAuthFilter(apiKeyRepository, objectMapper, 60, "memory", null);
        SecurityContextHolder.clearContext();
    }

    private String sha256(String input) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(hash);
    }

    private ApiKey buildApiKey(ApiKeyStatus status) {
        Member member = Member.builder()
            .email("test@test.com")
            .password("encoded")
            .name("테스터")
            .role(MemberRole.USER)
            .status(MemberStatus.ACTIVE)
            .build();
        ReflectionTestUtils.setField(member, "id", 1L);

        ApiKey apiKey = ApiKey.builder()
            .member(member)
            .keyName("테스트 키")
            .keyPrefix("test")
            .keyHash("hash")
            .status(status)
            .build();
        ReflectionTestUtils.setField(apiKey, "id", 1L);
        return apiKey;
    }

    @Test
    @DisplayName("유효한 API Key → 필터 통과 + SecurityContext 인증 주입")
    void validApiKey_passesFilter_andSetsAuthentication() throws Exception {
        String keyHash = sha256(VALID_KEY);
        ApiKey activeKey = buildApiKey(ApiKeyStatus.ACTIVE);
        given(apiKeyRepository.findByKeyHash(keyHash)).willReturn(Optional.of(activeKey));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/mcp/message/send");
        request.addHeader("X-API-Key", VALID_KEY);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        assertThat(principal).isInstanceOf(com.wisecan.unified.common.security.ApiKeyPrincipal.class);
        assertThat(((com.wisecan.unified.common.security.ApiKeyPrincipal) principal).id()).isEqualTo("apikey:1");
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("미존재 API Key → 401 Unauthorized")
    void unknownApiKey_returns401() throws Exception {
        given(apiKeyRepository.findByKeyHash(anyString())).willReturn(Optional.empty());

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/mcp/message/send");
        request.addHeader("X-API-Key", "unknown-key");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertThat(response.getStatus()).isEqualTo(401);
        String body = response.getContentAsString();
        assertThat(body).contains("유효하지 않은 API Key입니다");
        assertThat(body).contains("\"success\":false");
    }

    @Test
    @DisplayName("REVOKED API Key → 401 Unauthorized")
    void revokedApiKey_returns401() throws Exception {
        String keyHash = sha256(VALID_KEY);
        ApiKey revokedKey = buildApiKey(ApiKeyStatus.REVOKED);
        given(apiKeyRepository.findByKeyHash(keyHash)).willReturn(Optional.of(revokedKey));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/mcp/message/send");
        request.addHeader("X-API-Key", VALID_KEY);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertThat(response.getStatus()).isEqualTo(401);
        String body = response.getContentAsString();
        assertThat(body).contains("폐기된 API Key입니다");
        assertThat(body).contains("\"success\":false");
    }

    @Test
    @DisplayName("Rate Limit 초과 → 429 Too Many Requests")
    void rateLimitExceeded_returns429() throws Exception {
        // per-minute=1 로 설정한 필터 생성
        ApiKeyAuthFilter limitedFilter = new ApiKeyAuthFilter(
            apiKeyRepository, objectMapper, 1, "memory", null
        );

        String keyHash = sha256(VALID_KEY);
        ApiKey activeKey = buildApiKey(ApiKeyStatus.ACTIVE);
        given(apiKeyRepository.findByKeyHash(keyHash)).willReturn(Optional.of(activeKey));

        MockHttpServletRequest request1 = new MockHttpServletRequest();
        request1.setRequestURI("/mcp/message/send");
        request1.addHeader("X-API-Key", VALID_KEY);
        MockHttpServletResponse response1 = new MockHttpServletResponse();
        limitedFilter.doFilter(request1, response1, filterChain);
        assertThat(response1.getStatus()).isEqualTo(200); // 첫 번째 요청은 통과

        SecurityContextHolder.clearContext();

        MockHttpServletRequest request2 = new MockHttpServletRequest();
        request2.setRequestURI("/mcp/message/send");
        request2.addHeader("X-API-Key", VALID_KEY);
        MockHttpServletResponse response2 = new MockHttpServletResponse();
        limitedFilter.doFilter(request2, response2, filterChain);
        assertThat(response2.getStatus()).isEqualTo(429); // 두 번째는 limit 초과
        assertThat(response2.getContentAsString()).contains("한도를 초과");
    }
}
