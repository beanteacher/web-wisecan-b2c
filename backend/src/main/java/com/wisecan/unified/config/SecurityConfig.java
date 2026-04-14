package com.wisecan.unified.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wisecan.unified.repository.ApiKeyRepository;
import com.wisecan.unified.service.TokenBlacklistService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.Nullable;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtProvider jwtProvider;
    private final ApiKeyRepository apiKeyRepository;
    private final ObjectMapper objectMapper;
    private final TokenBlacklistService tokenBlacklistService;

    @Nullable
    private StringRedisTemplate redisTemplate;

    @Value("${wisecan.rate-limit.per-minute:60}")
    private int rateLimitPerMinute;

    @Value("${wisecan.rate-limit.mode:redis}")
    private String rateLimitMode;

    @Autowired(required = false)
    public void setRedisTemplate(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:3000"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public ApiKeyAuthFilter apiKeyAuthFilter() {
        return new ApiKeyAuthFilter(apiKeyRepository, objectMapper, rateLimitPerMinute, rateLimitMode, redisTemplate);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .cors(Customizer.withDefaults())
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // 공개 경로: 인증 없이 접근 가능
                .requestMatchers("/api/v1/auth/**", "/actuator/**").permitAll()
                // MCP 도구 경로: ApiKeyAuthFilter가 /mcp/**에서 인증 처리 (JWT 필터는 shouldNotFilter로 통과)
                .requestMatchers("/mcp/**").permitAll()
                // 나머지: JWT 인증 필요
                .anyRequest().authenticated()
            )
            // JWT 필터: /api/v1/auth/**, /api/v1/api-keys/** 등 JWT 경로에 적용
            .addFilterBefore(new JwtAuthenticationFilter(jwtProvider, tokenBlacklistService), UsernamePasswordAuthenticationFilter.class)
            // ApiKey 필터: /mcp/** 경로에만 적용 (JWT 필터 이후)
            .addFilterAfter(apiKeyAuthFilter(), JwtAuthenticationFilter.class)
            .build();
    }
}
