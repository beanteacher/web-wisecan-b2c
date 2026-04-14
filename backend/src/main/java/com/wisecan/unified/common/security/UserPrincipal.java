package com.wisecan.unified.common.security;

import java.util.Set;

public record UserPrincipal(Long memberId, String email, Set<String> roles) implements CallerPrincipal {
    @Override public String id() {
        return memberId != null ? "user:" + memberId : "user:" + email;
    }
    @Override public String channel() { return "REST"; }
    @Override public Set<String> scopes() { return roles; }
}
