package com.wisecan.unified.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wisecan.unified.config.JwtProvider;
import com.wisecan.unified.dto.AuthDto;
import com.wisecan.unified.exception.DuplicateEmailException;
import com.wisecan.unified.repository.ApiKeyRepository;
import com.wisecan.unified.service.AuthService;
import com.wisecan.unified.service.TokenBlacklistService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthService authService;

    @MockBean
    private JwtProvider jwtProvider;

    @MockBean
    private ApiKeyRepository apiKeyRepository;

    @MockBean
    private TokenBlacklistService tokenBlacklistService;

    @Test
    @DisplayName("회원가입 성공 - 201 Created")
    @WithMockUser
    void register_success() throws Exception {
        AuthDto.RegisterRequest request = new AuthDto.RegisterRequest(
            "user@test.com", "password123", "홍길동"
        );
        AuthDto.TokenResponse response = new AuthDto.TokenResponse(
            "accessToken", "refreshToken", "user@test.com", "홍길동"
        );

        given(authService.register(any())).willReturn(response);

        mockMvc.perform(post("/api/v1/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.accessToken").value("accessToken"))
            .andExpect(jsonPath("$.data.email").value("user@test.com"));
    }

    @Test
    @DisplayName("중복 이메일 회원가입 - 409 Conflict")
    @WithMockUser
    void register_duplicateEmail_conflict() throws Exception {
        AuthDto.RegisterRequest request = new AuthDto.RegisterRequest(
            "dup@test.com", "password123", "홍길동"
        );

        given(authService.register(any())).willThrow(new DuplicateEmailException("dup@test.com"));

        mockMvc.perform(post("/api/v1/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("회원가입 유효성 검증 실패 - 400 Bad Request")
    @WithMockUser
    void register_invalidRequest_badRequest() throws Exception {
        AuthDto.RegisterRequest request = new AuthDto.RegisterRequest(
            "invalid-email", "short", ""
        );

        mockMvc.perform(post("/api/v1/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("로그인 성공 - 200 OK")
    @WithMockUser
    void login_success() throws Exception {
        AuthDto.LoginRequest request = new AuthDto.LoginRequest("user@test.com", "password123");
        AuthDto.TokenResponse response = new AuthDto.TokenResponse(
            "accessToken", "refreshToken", "user@test.com", "홍길동"
        );

        given(authService.login(any())).willReturn(response);

        mockMvc.perform(post("/api/v1/auth/login")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.accessToken").value("accessToken"));
    }

    @Test
    @DisplayName("잘못된 비밀번호 로그인 - 400 Bad Request")
    @WithMockUser
    void login_wrongPassword_badRequest() throws Exception {
        AuthDto.LoginRequest request = new AuthDto.LoginRequest("user@test.com", "wrongPassword");

        given(authService.login(any())).willThrow(new RuntimeException("이메일 또는 비밀번호가 일치하지 않습니다"));

        mockMvc.perform(post("/api/v1/auth/login")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("로그아웃 - 200 OK 및 토큰 블랙리스트 등록")
    @WithMockUser
    void logout_success() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout")
                .with(csrf())
                .header("Authorization", "Bearer valid-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));

        verify(authService).logout(eq("valid-token"));
    }

    @Test
    @DisplayName("Authorization 헤더 없이 로그아웃 호출 - 200 OK")
    @WithMockUser
    void logout_noHeader_success() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout").with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));

        verify(authService).logout(null);
    }
}
