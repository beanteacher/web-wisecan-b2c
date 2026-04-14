package com.wisecan.unified.domain;

import jakarta.persistence.*;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "api_key")
@Getter
@NoArgsConstructor
public class ApiKey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(nullable = false, length = 100)
    private String keyName;

    @Column(nullable = false, length = 8)
    private String keyPrefix;

    @Column(nullable = false, length = 255)
    private String keyHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ApiKeyStatus status;

    private LocalDateTime lastUsedAt;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    @Builder
    public ApiKey(Member member, String keyName, String keyPrefix, String keyHash, ApiKeyStatus status) {
        this.member = member;
        this.keyName = keyName;
        this.keyPrefix = keyPrefix;
        this.keyHash = keyHash;
        this.status = status;
    }

    public void revoke() {
        this.status = ApiKeyStatus.REVOKED;
    }

    public void updateLastUsedAt() {
        this.lastUsedAt = LocalDateTime.now();
    }
}
