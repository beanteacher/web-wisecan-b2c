package com.wisecan.unified.service;

import com.wisecan.unified.domain.ApiKey;
import com.wisecan.unified.domain.ApiKeyStatus;
import com.wisecan.unified.domain.Member;
import com.wisecan.unified.dto.ApiKeyDto;
import com.wisecan.unified.exception.EntityNotFoundException;
import com.wisecan.unified.repository.ApiKeyRepository;
import com.wisecan.unified.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class ApiKeyService {

    private final ApiKeyRepository apiKeyRepository;
    private final MemberRepository memberRepository;

    public ApiKeyDto.CreateResponse create(Long memberId, ApiKeyDto.CreateRequest request) {
        Member member = memberRepository.findById(memberId)
            .orElseThrow(() -> new EntityNotFoundException("Member", memberId));

        String rawKey = "wc_" + UUID.randomUUID().toString().replace("-", "");
        String keyPrefix = rawKey.substring(0, 8);
        String keyHash = sha256(rawKey);

        ApiKey apiKey = ApiKey.builder()
            .member(member)
            .keyName(request.keyName())
            .keyPrefix(keyPrefix)
            .keyHash(keyHash)
            .status(ApiKeyStatus.ACTIVE)
            .build();

        ApiKey saved = apiKeyRepository.save(apiKey);

        return new ApiKeyDto.CreateResponse(
            saved.getId(),
            saved.getKeyName(),
            saved.getKeyPrefix(),
            rawKey,
            saved.getStatus().name(),
            saved.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public List<ApiKeyDto.Response> getMyKeys(Long memberId) {
        return apiKeyRepository.findByMemberIdOrderByCreatedAtDescIdDesc(memberId)
            .stream()
            .map(ApiKeyDto.Response::from)
            .toList();
    }

    public void revoke(Long memberId, Long apiKeyId) {
        ApiKey apiKey = apiKeyRepository.findById(apiKeyId)
            .orElseThrow(() -> new EntityNotFoundException("ApiKey", apiKeyId));

        if (!apiKey.getMember().getId().equals(memberId)) {
            throw new RuntimeException("해당 API 키에 대한 권한이 없습니다.");
        }

        if (apiKey.getStatus() == ApiKeyStatus.REVOKED) {
            throw new RuntimeException("이미 비활성화된 API 키입니다.");
        }

        apiKey.revoke();
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 알고리즘을 찾을 수 없습니다.", e);
        }
    }
}
