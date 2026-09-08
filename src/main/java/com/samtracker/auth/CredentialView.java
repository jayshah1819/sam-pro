package com.samtracker.auth;

import java.time.Instant;

public record CredentialView(Long id, Long tenantId, String username, String role, Instant createdAt,
        Instant lastLoginAt) {
}
