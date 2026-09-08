package com.samtracker.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.List;

public interface CredentialRepository extends JpaRepository<Credential, Long> {
    Optional<Credential> findByUsername(String username);

    Optional<Credential> findByTenantIdAndUsername(Long tenantId, String username);

    List<Credential> findByTenantId(Long tenantId);

    Optional<Credential> findByIdAndTenantId(Long id, Long tenantId);

    // Single statement so a request never loads/flushes the whole entity just to
    // stamp activity
    @Modifying
    @Query("update Credential c set c.lastSeenAt = :now where c.username = :username")
    int touchLastSeen(@Param("username") String username, @Param("now") Instant now);
}
