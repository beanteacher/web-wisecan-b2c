package com.wisecan.unified.controller;

import com.wisecan.unified.config.JwtProvider;
import com.wisecan.unified.repository.ApiKeyRepository;
import com.wisecan.unified.domain.Member;
import com.wisecan.unified.domain.MemberRole;
import com.wisecan.unified.domain.MemberStatus;
import com.wisecan.unified.dto.UsageDto;
import com.wisecan.unified.repository.MemberRepository;
import com.wisecan.unified.service.UsageService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UsageController.class)
class UsageControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UsageService usageService;

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
    @DisplayName("GET /api/v1/usage/summary - 요약 조회 성공")
    void getSummary_success_returns200() throws Exception {
        Member member = stubMember();
        given(memberRepository.findByEmail("test@example.com")).willReturn(Optional.of(member));

        UsageDto.SummaryResponse summary = new UsageDto.SummaryResponse(100L, 90L, 10L, 5L);
        given(usageService.getSummary(1L)).willReturn(summary);

        mockMvc.perform(get("/api/v1/usage/summary"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.totalCalls").value(100))
            .andExpect(jsonPath("$.data.successCount").value(90))
            .andExpect(jsonPath("$.data.failCount").value(10))
            .andExpect(jsonPath("$.data.todayCalls").value(5));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    @DisplayName("GET /api/v1/usage/history - 이력 페이지네이션 조회 성공")
    void getHistory_success_returns200() throws Exception {
        Member member = stubMember();
        given(memberRepository.findByEmail("test@example.com")).willReturn(Optional.of(member));

        UsageDto.Response item = new UsageDto.Response(
            1L, "내 키", "wc_1234", "search_tool", "SUCCESS", 120, null, LocalDateTime.now()
        );
        PageImpl<UsageDto.Response> page = new PageImpl<>(List.of(item), PageRequest.of(0, 20), 1);
        given(usageService.getHistory(anyLong(), anyInt(), anyInt())).willReturn(page);

        mockMvc.perform(get("/api/v1/usage/history")
                .param("page", "0")
                .param("size", "20"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.content[0].toolName").value("search_tool"))
            .andExpect(jsonPath("$.data.content[0].status").value("SUCCESS"));
    }

    @Test
    @DisplayName("GET /api/v1/usage/summary - 인증 없으면 401")
    void getSummary_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/usage/summary"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/v1/usage/history - 인증 없으면 401")
    void getHistory_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/usage/history"))
            .andExpect(status().isUnauthorized());
    }
}
