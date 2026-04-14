package com.wisecan.unified.repository;

import com.wisecan.unified.domain.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
class ApiUsageRepositoryTest {

    @Autowired
    private ApiUsageRepository apiUsageRepository;

    @Autowired
    private ApiKeyRepository apiKeyRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private TestEntityManager entityManager;

    private Member member;
    private ApiKey apiKey;

    @BeforeEach
    void setUp() {
        member = memberRepository.save(Member.builder()
            .email("usage@example.com")
            .password("password")
            .name("사용자")
            .role(MemberRole.USER)
            .status(MemberStatus.ACTIVE)
            .build());

        apiKey = apiKeyRepository.save(ApiKey.builder()
            .member(member)
            .keyName("테스트키")
            .keyPrefix("wc_test")
            .keyHash("testhash")
            .status(ApiKeyStatus.ACTIVE)
            .build());
        entityManager.flush();
    }

    @Test
    @DisplayName("memberId로 사용 이력 페이지네이션 조회")
    void findByApiKeyMemberIdOrderByCalledAtDesc_returnsPaged() {
        for (int i = 0; i < 5; i++) {
            apiUsageRepository.save(ApiUsage.builder()
                .apiKey(apiKey)
                .toolName("tool_" + i)
                .status(UsageStatus.SUCCESS)
                .responseTimeMs(100)
                .errorMessage(null)
                .build());
            entityManager.flush();
        }

        Page<ApiUsage> page = apiUsageRepository.findByApiKeyMemberIdOrderByCalledAtDesc(
            member.getId(), PageRequest.of(0, 3));

        assertThat(page.getTotalElements()).isEqualTo(5);
        assertThat(page.getContent()).hasSize(3);
    }

    @Test
    @DisplayName("memberId로 전체 호출 수 집계")
    void countByApiKeyMemberId_returnsTotal() {
        apiUsageRepository.save(ApiUsage.builder()
            .apiKey(apiKey).toolName("tool1").status(UsageStatus.SUCCESS)
            .responseTimeMs(100).build());
        apiUsageRepository.save(ApiUsage.builder()
            .apiKey(apiKey).toolName("tool2").status(UsageStatus.FAIL)
            .responseTimeMs(200).errorMessage("에러").build());
        entityManager.flush();

        long count = apiUsageRepository.countByApiKeyMemberId(member.getId());
        assertThat(count).isEqualTo(2);
    }

    @Test
    @DisplayName("memberId + status로 성공/실패 건수 집계")
    void countByApiKeyMemberIdAndStatus_returnsFilteredCount() {
        apiUsageRepository.save(ApiUsage.builder()
            .apiKey(apiKey).toolName("t1").status(UsageStatus.SUCCESS)
            .responseTimeMs(100).build());
        apiUsageRepository.save(ApiUsage.builder()
            .apiKey(apiKey).toolName("t2").status(UsageStatus.SUCCESS)
            .responseTimeMs(150).build());
        apiUsageRepository.save(ApiUsage.builder()
            .apiKey(apiKey).toolName("t3").status(UsageStatus.FAIL)
            .responseTimeMs(300).errorMessage("err").build());
        entityManager.flush();

        long successCount = apiUsageRepository.countByApiKeyMemberIdAndStatus(member.getId(), UsageStatus.SUCCESS);
        long failCount = apiUsageRepository.countByApiKeyMemberIdAndStatus(member.getId(), UsageStatus.FAIL);

        assertThat(successCount).isEqualTo(2);
        assertThat(failCount).isEqualTo(1);
    }

    @Test
    @DisplayName("특정 시각 이후 호출 수 집계")
    void countByApiKeyMemberIdAndCalledAtAfter_returnsCount() {
        apiUsageRepository.save(ApiUsage.builder()
            .apiKey(apiKey).toolName("t1").status(UsageStatus.SUCCESS)
            .responseTimeMs(100).build());
        entityManager.flush();

        LocalDateTime beforeNow = LocalDateTime.now().minusMinutes(1);
        long count = apiUsageRepository.countByApiKeyMemberIdAndCalledAtAfter(member.getId(), beforeNow);

        assertThat(count).isEqualTo(1);
    }
}
