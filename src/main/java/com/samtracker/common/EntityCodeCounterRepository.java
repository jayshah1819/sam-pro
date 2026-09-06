package com.samtracker.common;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface EntityCodeCounterRepository extends JpaRepository<EntityCodeCounter, UUID> {
    Optional<EntityCodeCounter> findByTenantIdAndEntityKey(Long tenantId, String entityKey);
}
