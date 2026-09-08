package com.samtracker.auth;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

// Not tenant-scoped — must be queryable before a tenant context exists (login)
@Entity
@Table(name = "credentials", uniqueConstraints = @UniqueConstraint(name = "uq_credentials_username", columnNames = "username"))
@Getter
@Setter
@NoArgsConstructor
public class Credential {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "user_code", length = 32)
    private String userCode;

    // Plain column — not @TenantId — so this entity is never filtered by tenant
    // discriminator
    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    // Optional back-reference to the AppUser this credential belongs to
    @Column(name = "app_user_id")
    private UUID appUserId;

    // Stored as "VIEWER", "EDITOR", or "ADMIN"
    @Column(nullable = false, columnDefinition = "varchar(50) not null default 'VIEWER'")
    private String role = "VIEWER";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    // Refreshed (throttled) on each authenticated request so admins can see who is
    // currently active
    @Column(name = "last_seen_at")
    private Instant lastSeenAt;
}
