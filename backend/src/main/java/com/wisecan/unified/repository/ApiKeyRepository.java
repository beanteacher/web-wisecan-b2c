package com.wisecan.unified.repository;

import com.wisecan.unified.domain.ApiKey;
import com.wisecan.unified.domain.ApiKeyStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ApiKeyRepository extends JpaRepository<ApiKey, Long> {

    List<ApiKey> findByMemberIdAndStatus(Long memberId, ApiKeyStatus status);

    List<ApiKey> findByMemberIdOrderByCreatedAtDescIdDesc(Long memberId);

    Optional<ApiKey> findByKeyHash(String keyHash);
}
