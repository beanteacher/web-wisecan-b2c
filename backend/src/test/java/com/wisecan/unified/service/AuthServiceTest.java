package com.wisecan.unified.service;

import com.wisecan.unified.config.JwtProvider;
import com.wisecan.unified.domain.Member;
import com.wisecan.unified.domain.MemberRole;
import com.wisecan.unified.domain.MemberStatus;
import com.wisecan.unified.dto.AuthDto;
import com.wisecan.unified.exception.DuplicateEmailException;
import com.wisecan.unified.repository.MemberRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtProvider jwtProvider;

    @Mock
    private TokenBlacklistService tokenBlacklistService;

    @InjectMocks
    private AuthService authService;

    @Test
    @DisplayName("회원가입 성공")
    void register_success() {
        AuthDto.RegisterRequest request = new AuthDto.RegisterRequest(
            "user@test.com", "password123", "홍길동"
        );
        Member savedMember = Member.builder()
            .email("user@test.com")
            .password("encodedPassword")
            .name("홍길동")
            .role(MemberRole.USER)
            .status(MemberStatus.ACTIVE)
            .build();

        given(memberRepository.existsByEmail("user@test.com")).willReturn(false);
        given(passwordEncoder.encode("password123")).willReturn("encodedPassword");
        given(memberRepository.save(any(Member.class))).willReturn(savedMember);
        given(jwtProvider.generateAccessToken(anyString(), anyString())).willReturn("accessToken");
        given(jwtProvider.generateRefreshToken(anyString())).willReturn("refreshToken");

        AuthDto.TokenResponse response = authService.register(request);

        assertThat(response.accessToken()).isEqualTo("accessToken");
        assertThat(response.email()).isEqualTo("user@test.com");
        assertThat(response.name()).isEqualTo("홍길동");
        verify(memberRepository).save(any(Member.class));
    }

    @Test
    @DisplayName("중복 이메일로 회원가입 시 DuplicateEmailException 발생")
    void register_duplicateEmail_throwsException() {
        AuthDto.RegisterRequest request = new AuthDto.RegisterRequest(
            "dup@test.com", "password123", "홍길동"
        );
        given(memberRepository.existsByEmail("dup@test.com")).willReturn(true);

        assertThatThrownBy(() -> authService.register(request))
            .isInstanceOf(DuplicateEmailException.class)
            .hasMessageContaining("dup@test.com");
    }

    @Test
    @DisplayName("회원가입 시 비밀번호가 BCrypt로 해싱됨")
    void register_passwordHashed() {
        AuthDto.RegisterRequest request = new AuthDto.RegisterRequest(
            "user@test.com", "rawPassword", "홍길동"
        );
        Member savedMember = Member.builder()
            .email("user@test.com")
            .password("$2a$hashedPassword")
            .name("홍길동")
            .role(MemberRole.USER)
            .status(MemberStatus.ACTIVE)
            .build();

        given(memberRepository.existsByEmail(anyString())).willReturn(false);
        given(passwordEncoder.encode("rawPassword")).willReturn("$2a$hashedPassword");
        given(memberRepository.save(any(Member.class))).willReturn(savedMember);
        given(jwtProvider.generateAccessToken(anyString(), anyString())).willReturn("token");
        given(jwtProvider.generateRefreshToken(anyString())).willReturn("refresh");

        authService.register(request);

        verify(passwordEncoder).encode("rawPassword");
    }

    @Test
    @DisplayName("로그인 성공")
    void login_success() {
        AuthDto.LoginRequest request = new AuthDto.LoginRequest("user@test.com", "password123");
        Member member = Member.builder()
            .email("user@test.com")
            .password("encodedPassword")
            .name("홍길동")
            .role(MemberRole.USER)
            .status(MemberStatus.ACTIVE)
            .build();

        given(memberRepository.findByEmail("user@test.com")).willReturn(Optional.of(member));
        given(passwordEncoder.matches("password123", "encodedPassword")).willReturn(true);
        given(jwtProvider.generateAccessToken(anyString(), anyString())).willReturn("accessToken");
        given(jwtProvider.generateRefreshToken(anyString())).willReturn("refreshToken");

        AuthDto.TokenResponse response = authService.login(request);

        assertThat(response.accessToken()).isEqualTo("accessToken");
        assertThat(response.email()).isEqualTo("user@test.com");
    }

    @Test
    @DisplayName("잘못된 비밀번호로 로그인 시 RuntimeException 발생")
    void login_wrongPassword_throwsException() {
        AuthDto.LoginRequest request = new AuthDto.LoginRequest("user@test.com", "wrongPassword");
        Member member = Member.builder()
            .email("user@test.com")
            .password("encodedPassword")
            .name("홍길동")
            .role(MemberRole.USER)
            .status(MemberStatus.ACTIVE)
            .build();

        given(memberRepository.findByEmail("user@test.com")).willReturn(Optional.of(member));
        given(passwordEncoder.matches("wrongPassword", "encodedPassword")).willReturn(false);

        assertThatThrownBy(() -> authService.login(request))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("이메일 또는 비밀번호가 일치하지 않습니다");
    }

    @Test
    @DisplayName("존재하지 않는 이메일로 로그인 시 RuntimeException 발생")
    void login_emailNotFound_throwsException() {
        AuthDto.LoginRequest request = new AuthDto.LoginRequest("none@test.com", "password123");

        given(memberRepository.findByEmail("none@test.com")).willReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("이메일 또는 비밀번호가 일치하지 않습니다");
    }
}
