package com.wisecan.unified.common.security;

import java.util.Set;

public record ApiKeyPrincipal(Long apiKeyId, Long memberId, Set<String> scopes) implements CallerPrincipal {
    @Override public String id() { return "apikey:" + apiKeyId; }
    @Override public String channel() { return "MCP"; }
}
