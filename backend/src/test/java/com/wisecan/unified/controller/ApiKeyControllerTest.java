package com.wisecan.unified.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wisecan.unified.config.JwtProvider;
import com.wisecan.unified.domain.ApiKeyStatus;
import com.wisecan.unified.domain.Member;
import com.wisecan.unified.repository.ApiKeyRepository;
import com.wisecan.unified.domain.MemberRole;
import com.wisecan.unified.domain.MemberStatus;
import com.wisecan.unified.dto.ApiKeyDto;
import com.wisecan.unified.exception.EntityNotFoundException;
import com.wisecan.unified.repository.MemberRepository;
import com.wisecan.unified.service.ApiKeyService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ApiKeyController.class)
class ApiKeyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ApiKeyService apiKeyService;

    @MockBean
    private MemberRepository memberRepository;

    @MockBean
    private JwtProvider jwtProvider;

    @MockBean
    private ApiKeyRepository apiKeyRepository;

    private Member stubMember() {
        Member member = Member.builder()
            .email("test@example.com")
            .password("pw")
            .name("테스터")
            .role(MemberRole.USER)
            .status(MemberStatus.ACTIVE)
            .build();
        org.springframework.test.util.ReflectionTestUtils.setField(member, "id", 1L);
        return member;
    }

    @Test
    @WithMockUser(username = "test@example.com")
    @DisplayName("POST /api/v1/api-keys - API 키 발급 성공")
    void create_success_returns201() throws Exception {
        Member member = stubMember();
        given(memberRepository.findByEmail("test@example.com")).willReturn(Optional.of(member));

        ApiKeyDto.CreateResponse response = new ApiKeyDto.CreateResponse(
            1L, "내 키", "wc_1234", "wc_1234abcdsecret", "ACTIVE", LocalDateTime.now()
        );
        given(apiKeyService.create(anyLong(), any())).willReturn(response);

        mockMvc.perform(post("/api/v1/api-keys")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ApiKeyDto.CreateRequest("내 키"))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.rawKey").value("wc_1234abcdsecret"))
            .andExpect(jsonPath("$.data.keyName").value("내 키"));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    @DisplayName("POST /api/v1/api-keys - keyName 공백이면 400")
    void create_blankKeyName_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/api-keys")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ApiKeyDto.CreateRequest(""))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("POST /api/v1/api-keys - 인증 없으면 401")
    void create_noAuth_returns401() throws Exception {
        mockMvc.perform(post("/api/v1/api-keys")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ApiKeyDto.CreateRequest("키"))))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    @DisplayName("GET /api/v1/api-keys - 내 키 목록 조회 성공")
    void getMyKeys_success_returns200() throws Exception {
        Member member = stubMember();
        given(memberRepository.findByEmail("test@example.com")).willReturn(Optional.of(member));

        ApiKeyDto.Response keyResponse = new ApiKeyDto.Response(
            1L, "내 키", "wc_1234", "ACTIVE", null, LocalDateTime.now()
        );
        given(apiKeyService.getMyKeys(1L)).willReturn(List.of(keyResponse));

        mockMvc.perform(get("/api/v1/api-keys"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data[0].keyName").value("내 키"))
            .andExpect(jsonPath("$.data[0].status").value("ACTIVE"));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    @DisplayName("PATCH /api/v1/api-keys/{id}/revoke - revoke 성공")
    void revoke_success_returns200() throws Exception {
        Member member = stubMember();
        given(memberRepository.findByEmail("test@example.com")).willReturn(Optional.of(member));

        mockMvc.perform(patch("/api/v1/api-keys/1/revoke").with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    @DisplayName("PATCH /api/v1/api-keys/{id}/revoke - 권한 없으면 400")
    void revoke_unauthorized_returns400() throws Exception {
        Member member = stubMember();
        given(memberRepository.findByEmail("test@example.com")).willReturn(Optional.of(member));
        doThrow(new RuntimeException("해당 API 키에 대한 권한이 없습니다."))
            .when(apiKeyService).revoke(anyLong(), anyLong());

        mockMvc.perform(patch("/api/v1/api-keys/99/revoke").with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false));
    }
}
