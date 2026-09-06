package com.samtracker.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface CredentialRepository extends JpaRepository<Credential, Long> {
    Optional<Credential> findByUsername(String username);

    Optional<Credential> findByTenantIdAndUsername(Long tenantId, String username);

    List<Credential> findByTenantId(Long tenantId);

    Optional<Credential> findByIdAndTenantId(Long id, Long tenantId);
}
