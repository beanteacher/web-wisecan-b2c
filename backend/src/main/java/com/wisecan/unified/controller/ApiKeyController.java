package com.wisecan.unified.controller;

import com.wisecan.unified.domain.Member;
import com.wisecan.unified.dto.ApiKeyDto;
import com.wisecan.unified.dto.ApiResponse;
import com.wisecan.unified.exception.EntityNotFoundException;
import com.wisecan.unified.repository.MemberRepository;
import com.wisecan.unified.service.ApiKeyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/api-keys")
@RequiredArgsConstructor
public class ApiKeyController {

    private final ApiKeyService apiKeyService;
    private final MemberRepository memberRepository;

    @PostMapping
    public ResponseEntity<ApiResponse<ApiKeyDto.CreateResponse>> create(
        @RequestBody @Valid ApiKeyDto.CreateRequest request
    ) {
        Long memberId = resolveCurrentMemberId();
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success(apiKeyService.create(memberId, request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ApiKeyDto.Response>>> getMyKeys() {
        Long memberId = resolveCurrentMemberId();
        return ResponseEntity.ok(ApiResponse.success(apiKeyService.getMyKeys(memberId)));
    }

    @PatchMapping("/{id}/revoke")
    public ResponseEntity<ApiResponse<Void>> revoke(@PathVariable Long id) {
        Long memberId = resolveCurrentMemberId();
        apiKeyService.revoke(memberId, id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    private Long resolveCurrentMemberId() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Member member = memberRepository.findByEmail(email)
            .orElseThrow(() -> new EntityNotFoundException("Member", 0L));
        return member.getId();
    }
}
