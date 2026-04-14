package com.wisecan.unified.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AuthDto {

    public record RegisterRequest(
        @NotBlank(message = "이메일은 필수입니다") @Email(message = "올바른 이메일 형식이 아닙니다") String email,
        @NotBlank(message = "비밀번호는 필수입니다") @Size(min = 8, message = "비밀번호는 8자 이상이어야 합니다") String password,
        @NotBlank(message = "이름은 필수입니다") String name
    ) {}

    public record LoginRequest(
        @NotBlank(message = "이메일은 필수입니다") @Email(message = "올바른 이메일 형식이 아닙니다") String email,
        @NotBlank(message = "비밀번호는 필수입니다") String password
    ) {}

    public record TokenResponse(
        String accessToken,
        String refreshToken,
        String email,
        String name
    ) {}
}
