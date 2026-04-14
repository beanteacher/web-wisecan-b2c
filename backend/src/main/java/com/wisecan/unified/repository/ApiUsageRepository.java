package com.wisecan.unified.repository;

import com.wisecan.unified.domain.ApiUsage;
import com.wisecan.unified.domain.UsageStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;

public interface ApiUsageRepository extends JpaRepository<ApiUsage, Long> {

    Page<ApiUsage> findByApiKeyMemberIdOrderByCalledAtDesc(Long memberId, Pageable pageable);

    long countByApiKeyMemberId(Long memberId);

    long countByApiKeyMemberIdAndStatus(Long memberId, UsageStatus status);

    long countByApiKeyIdAndStatus(Long apiKeyId, UsageStatus status);

    long countByApiKeyMemberIdAndCalledAtAfter(Long memberId, LocalDateTime after);
}
