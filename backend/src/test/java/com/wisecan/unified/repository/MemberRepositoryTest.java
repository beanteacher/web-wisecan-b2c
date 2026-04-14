package com.wisecan.unified.repository;

import com.wisecan.unified.domain.Member;
import com.wisecan.unified.domain.MemberRole;
import com.wisecan.unified.domain.MemberStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class MemberRepositoryTest {

    @Autowired
    private MemberRepository memberRepository;

    private Member createMember(String email) {
        return memberRepository.save(Member.builder()
            .email(email)
            .password("encodedPassword")
            .name("테스트유저")
            .role(MemberRole.USER)
            .status(MemberStatus.ACTIVE)
            .build());
    }

    @Test
    @DisplayName("이메일로 회원 조회 성공")
    void findByEmail_success() {
        createMember("test@test.com");

        Optional<Member> result = memberRepository.findByEmail("test@test.com");

        assertThat(result).isPresent();
        assertThat(result.get().getEmail()).isEqualTo("test@test.com");
    }

    @Test
    @DisplayName("존재하지 않는 이메일 조회 시 빈 Optional 반환")
    void findByEmail_notFound() {
        Optional<Member> result = memberRepository.findByEmail("none@test.com");

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("이메일 존재 여부 확인 - 존재")
    void existsByEmail_true() {
        createMember("exists@test.com");

        assertThat(memberRepository.existsByEmail("exists@test.com")).isTrue();
    }

    @Test
    @DisplayName("이메일 존재 여부 확인 - 미존재")
    void existsByEmail_false() {
        assertThat(memberRepository.existsByEmail("none@test.com")).isFalse();
    }

    @Test
    @DisplayName("회원 저장 시 createdAt 자동 설정")
    void save_createdAtAutoSet() {
        Member saved = createMember("auto@test.com");

        assertThat(saved.getCreatedAt()).isNotNull();
    }
}
