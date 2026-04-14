package com.wisecan.unified.common.security;

import java.util.Set;

public sealed interface CallerPrincipal permits UserPrincipal, ApiKeyPrincipal {
    String id();          // 감사 로그용 고유 식별자
    String channel();     // "REST" | "MCP"
    Set<String> scopes(); // role 또는 tool scope
}
