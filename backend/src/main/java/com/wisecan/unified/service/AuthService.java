package com.wisecan.unified.service;

import com.wisecan.unified.config.JwtProvider;
import com.wisecan.unified.domain.Member;
import com.wisecan.unified.domain.MemberRole;
import com.wisecan.unified.domain.MemberStatus;
import com.wisecan.unified.dto.AuthDto;
import com.wisecan.unified.exception.DuplicateEmailException;
import com.wisecan.unified.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class AuthService {

    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;
    private final TokenBlacklistService tokenBlacklistService;

    public AuthDto.TokenResponse register(AuthDto.RegisterRequest request) {
        if (memberRepository.existsByEmail(request.email())) {
            throw new DuplicateEmailException(request.email());
        }

        Member member = Member.builder()
            .email(request.email())
            .password(passwordEncoder.encode(request.password()))
            .name(request.name())
            .role(MemberRole.USER)
            .status(MemberStatus.ACTIVE)
            .build();

        memberRepository.save(member);

        String accessToken = jwtProvider.generateAccessToken(member.getEmail(), member.getRole().name());
        String refreshToken = jwtProvider.generateRefreshToken(member.getEmail());

        return new AuthDto.TokenResponse(accessToken, refreshToken, member.getEmail(), member.getName());
    }

    public AuthDto.TokenResponse login(AuthDto.LoginRequest request) {
        Member member = memberRepository.findByEmail(request.email())
            .orElseThrow(() -> new RuntimeException("이메일 또는 비밀번호가 일치하지 않습니다"));

        if (!passwordEncoder.matches(request.password(), member.getPassword())) {
            throw new RuntimeException("이메일 또는 비밀번호가 일치하지 않습니다");
        }

        String accessToken = jwtProvider.generateAccessToken(member.getEmail(), member.getRole().name());
        String refreshToken = jwtProvider.generateRefreshToken(member.getEmail());

        return new AuthDto.TokenResponse(accessToken, refreshToken, member.getEmail(), member.getName());
    }

    public void logout(String token) {
        if (token == null || token.isBlank() || !jwtProvider.validateToken(token)) {
            return;
        }
        long ttl = jwtProvider.getExpiration(token).getTime() - System.currentTimeMillis();
        tokenBlacklistService.blacklist(token, ttl);
    }
}
