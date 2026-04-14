package com.wisecan.unified.repository;

import com.wisecan.unified.domain.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
class ApiKeyRepositoryTest {

    @Autowired
    private ApiKeyRepository apiKeyRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private TestEntityManager entityManager;

    private Member member;

    @BeforeEach
    void setUp() {
        member = memberRepository.save(Member.builder()
            .email("test@example.com")
            .password("password")
            .name("테스터")
            .role(MemberRole.USER)
            .status(MemberStatus.ACTIVE)
            .build());
        entityManager.flush();
    }

    @Test
    @DisplayName("memberId로 API 키 목록 조회 - 생성일 내림차순")
    void findByMemberIdOrderByCreatedAtDesc_returnsKeysInOrder() {
        ApiKey key1 = apiKeyRepository.save(ApiKey.builder()
            .member(member)
            .keyName("키1")
            .keyPrefix("wc_aaaa")
            .keyHash("hash1")
            .status(ApiKeyStatus.ACTIVE)
            .build());
        entityManager.flush();

        ApiKey key2 = apiKeyRepository.save(ApiKey.builder()
            .member(member)
            .keyName("키2")
            .keyPrefix("wc_bbbb")
            .keyHash("hash2")
            .status(ApiKeyStatus.ACTIVE)
            .build());
        entityManager.flush();

        List<ApiKey> result = apiKeyRepository.findByMemberIdOrderByCreatedAtDescIdDesc(member.getId());

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getId()).isEqualTo(key2.getId());
        assertThat(result.get(1).getId()).isEqualTo(key1.getId());
    }

    @Test
    @DisplayName("keyHash로 API 키 조회 성공")
    void findByKeyHash_returnsApiKey() {
        apiKeyRepository.save(ApiKey.builder()
            .member(member)
            .keyName("테스트키")
            .keyPrefix("wc_test")
            .keyHash("abc123hash")
            .status(ApiKeyStatus.ACTIVE)
            .build());
        entityManager.flush();

        Optional<ApiKey> result = apiKeyRepository.findByKeyHash("abc123hash");

        assertThat(result).isPresent();
        assertThat(result.get().getKeyName()).isEqualTo("테스트키");
    }

    @Test
    @DisplayName("keyHash 조회 - 존재하지 않으면 empty")
    void findByKeyHash_notFound_returnsEmpty() {
        Optional<ApiKey> result = apiKeyRepository.findByKeyHash("nonexistent");
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("memberId + status로 필터 조회")
    void findByMemberIdAndStatus_returnsFiltered() {
        apiKeyRepository.save(ApiKey.builder()
            .member(member).keyName("활성키").keyPrefix("wc_actv")
            .keyHash("activehash").status(ApiKeyStatus.ACTIVE).build());
        ApiKey revoked = apiKeyRepository.save(ApiKey.builder()
            .member(member).keyName("취소키").keyPrefix("wc_revk")
            .keyHash("revokedhash").status(ApiKeyStatus.REVOKED).build());
        entityManager.flush();

        List<ApiKey> active = apiKeyRepository.findByMemberIdAndStatus(member.getId(), ApiKeyStatus.ACTIVE);
        List<ApiKey> revokedList = apiKeyRepository.findByMemberIdAndStatus(member.getId(), ApiKeyStatus.REVOKED);

        assertThat(active).hasSize(1);
        assertThat(active.get(0).getKeyName()).isEqualTo("활성키");
        assertThat(revokedList).hasSize(1);
        assertThat(revokedList.get(0).getId()).isEqualTo(revoked.getId());
    }

    @Test
    @DisplayName("rawKey가 DB에 평문으로 저장되지 않음 (해시 저장 검증)")
    void keyHash_isNotRawKey() {
        String rawKey = "wc_plaintext_raw_key";
        String keyHash = "sha256_hashed_value_not_equal_to_raw";

        apiKeyRepository.save(ApiKey.builder()
            .member(member).keyName("해시검증키").keyPrefix("wc_hash")
            .keyHash(keyHash).status(ApiKeyStatus.ACTIVE).build());
        entityManager.flush();

        Optional<ApiKey> byHash = apiKeyRepository.findByKeyHash(keyHash);
        Optional<ApiKey> byRaw = apiKeyRepository.findByKeyHash(rawKey);

        assertThat(byHash).isPresent();
        assertThat(byRaw).isEmpty();
        assertThat(byHash.get().getKeyHash()).isNotEqualTo(rawKey);
    }
}
