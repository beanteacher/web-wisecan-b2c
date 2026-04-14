package com.wisecan.unified.service;

import com.wisecan.unified.domain.*;
import com.wisecan.unified.dto.ApiKeyDto;
import com.wisecan.unified.exception.EntityNotFoundException;
import com.wisecan.unified.repository.ApiKeyRepository;
import com.wisecan.unified.repository.MemberRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ApiKeyServiceTest {

    @InjectMocks
    private ApiKeyService apiKeyService;

    @Mock
    private ApiKeyRepository apiKeyRepository;

    @Mock
    private MemberRepository memberRepository;

    private Member stubMember() {
        return Member.builder()
            .email("test@example.com")
            .password("pw")
            .name("테스터")
            .role(MemberRole.USER)
            .status(MemberStatus.ACTIVE)
            .build();
    }

    @Test
    @DisplayName("API 키 발급 - rawKey는 1회만 반환, DB에는 해시 저장")
    void create_rawKeyReturnedOnce_hashStoredInDb() {
        Member member = stubMember();
        given(memberRepository.findById(1L)).willReturn(Optional.of(member));

        ApiKey savedKey = ApiKey.builder()
            .member(member)
            .keyName("내 키")
            .keyPrefix("wc_xxxxx")
            .keyHash("sha256hashedvalue")
            .status(ApiKeyStatus.ACTIVE)
            .build();
        given(apiKeyRepository.save(any(ApiKey.class))).willReturn(savedKey);

        ApiKeyDto.CreateResponse response = apiKeyService.create(1L, new ApiKeyDto.CreateRequest("내 키"));

        assertThat(response.rawKey()).isNotNull();
        assertThat(response.rawKey()).startsWith("wc_");
        // rawKey는 해시값과 달라야 함
        assertThat(response.rawKey()).isNotEqualTo(savedKey.getKeyHash());
        verify(apiKeyRepository).save(any(ApiKey.class));
    }

    @Test
    @DisplayName("API 키 발급 - rawKey의 SHA-256 해시가 저장됨을 검증")
    void create_savedKeyHash_isNotRawKey() {
        Member member = stubMember();
        given(memberRepository.findById(1L)).willReturn(Optional.of(member));

        given(apiKeyRepository.save(any(ApiKey.class))).willAnswer(inv -> inv.getArgument(0));

        ApiKeyDto.CreateResponse response = apiKeyService.create(1L, new ApiKeyDto.CreateRequest("키이름"));

        String rawKey = response.rawKey();
        // rawKey는 "wc_" + UUID 형식
        assertThat(rawKey).startsWith("wc_");
        // DB에 저장되는 keyHash는 rawKey와 달라야 함 (평문 저장 금지)
        assertThat(rawKey).doesNotMatch("[a-f0-9]{64}"); // rawKey는 SHA-256 hex 형식이 아님
    }

    @Test
    @DisplayName("API 키 발급 - 존재하지 않는 memberId면 EntityNotFoundException")
    void create_memberNotFound_throwsEntityNotFoundException() {
        given(memberRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> apiKeyService.create(99L, new ApiKeyDto.CreateRequest("키")))
            .isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    @DisplayName("내 API 키 목록 조회")
    void getMyKeys_returnsKeys() {
        Member member = stubMember();
        ApiKey key = ApiKey.builder()
            .member(member).keyName("키1").keyPrefix("wc_xxxx")
            .keyHash("hash1").status(ApiKeyStatus.ACTIVE).build();

        given(apiKeyRepository.findByMemberIdOrderByCreatedAtDescIdDesc(1L)).willReturn(List.of(key));

        List<ApiKeyDto.Response> result = apiKeyService.getMyKeys(1L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).keyName()).isEqualTo("키1");
        assertThat(result.get(0).status()).isEqualTo("ACTIVE");
    }

    @Test
    @DisplayName("API 키 revoke - 성공")
    void revoke_success() {
        Member member = stubMember();
        ApiKey key = ApiKey.builder()
            .member(member).keyName("키").keyPrefix("wc_xxxx")
            .keyHash("hash").status(ApiKeyStatus.ACTIVE).build();

        // member id를 리플렉션으로 설정
        org.springframework.test.util.ReflectionTestUtils.setField(member, "id", 1L);

        given(apiKeyRepository.findById(10L)).willReturn(Optional.of(key));

        apiKeyService.revoke(1L, 10L);

        assertThat(key.getStatus()).isEqualTo(ApiKeyStatus.REVOKED);
    }

    @Test
    @DisplayName("API 키 revoke - 다른 멤버가 시도하면 RuntimeException")
    void revoke_unauthorizedMember_throwsRuntimeException() {
        Member owner = stubMember();
        org.springframework.test.util.ReflectionTestUtils.setField(owner, "id", 1L);

        ApiKey key = ApiKey.builder()
            .member(owner).keyName("키").keyPrefix("wc_xxxx")
            .keyHash("hash").status(ApiKeyStatus.ACTIVE).build();

        given(apiKeyRepository.findById(10L)).willReturn(Optional.of(key));

        assertThatThrownBy(() -> apiKeyService.revoke(2L, 10L))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("권한");
    }

    @Test
    @DisplayName("API 키 revoke - 이미 REVOKED된 키면 RuntimeException")
    void revoke_alreadyRevoked_throwsRuntimeException() {
        Member member = stubMember();
        org.springframework.test.util.ReflectionTestUtils.setField(member, "id", 1L);

        ApiKey key = ApiKey.builder()
            .member(member).keyName("키").keyPrefix("wc_xxxx")
            .keyHash("hash").status(ApiKeyStatus.REVOKED).build();

        given(apiKeyRepository.findById(10L)).willReturn(Optional.of(key));

        assertThatThrownBy(() -> apiKeyService.revoke(1L, 10L))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("이미 비활성화");
    }
}
