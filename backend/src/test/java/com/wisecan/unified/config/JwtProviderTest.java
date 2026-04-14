package com.wisecan.unified.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtProviderTest {

    private JwtProvider jwtProvider;

    @BeforeEach
    void setUp() {
        jwtProvider = new JwtProvider(
            "test-jwt-secret-key-must-be-at-least-256-bits-long-for-hs256-algorithm",
            3600000L,
            604800000L
        );
    }

    @Test
    @DisplayName("액세스 토큰 생성 후 검증 성공")
    void generateAndValidateAccessToken() {
        String token = jwtProvider.generateAccessToken("user@test.com", "USER");

        assertThat(jwtProvider.validateToken(token)).isTrue();
        assertThat(jwtProvider.getEmail(token)).isEqualTo("user@test.com");
        assertThat(jwtProvider.getRole(token)).isEqualTo("USER");
    }

    @Test
    @DisplayName("리프레시 토큰 생성 후 검증 성공")
    void generateAndValidateRefreshToken() {
        String token = jwtProvider.generateRefreshToken("user@test.com");

        assertThat(jwtProvider.validateToken(token)).isTrue();
        assertThat(jwtProvider.getEmail(token)).isEqualTo("user@test.com");
    }

    @Test
    @DisplayName("잘못된 토큰 검증 실패")
    void validateInvalidToken() {
        assertThat(jwtProvider.validateToken("invalid.token.value")).isFalse();
    }

    @Test
    @DisplayName("빈 토큰 검증 실패")
    void validateEmptyToken() {
        assertThat(jwtProvider.validateToken("")).isFalse();
    }
}
