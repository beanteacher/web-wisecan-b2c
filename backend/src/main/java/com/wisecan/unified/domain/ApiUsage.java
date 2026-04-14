package com.wisecan.unified.domain;

import jakarta.persistence.*;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "api_usage")
@Getter
@NoArgsConstructor
public class ApiUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "api_key_id", nullable = false)
    private ApiKey apiKey;

    @Column(nullable = false, length = 100)
    private String toolName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UsageStatus status;

    private int responseTimeMs;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Column(updatable = false)
    private LocalDateTime calledAt;

    @PrePersist
    protected void onCreate() {
        this.calledAt = LocalDateTime.now();
    }

    @Builder
    public ApiUsage(ApiKey apiKey, String toolName, UsageStatus status, int responseTimeMs, String errorMessage) {
        this.apiKey = apiKey;
        this.toolName = toolName;
        this.status = status;
        this.responseTimeMs = responseTimeMs;
        this.errorMessage = errorMessage;
    }
}
