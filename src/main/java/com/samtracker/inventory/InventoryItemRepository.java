package com.samtracker.inventory;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {

    List<InventoryItem> findByTenantIdOrderBySoftwareCodeAsc(Long tenantId);

    Optional<InventoryItem> findByTenantIdAndSoftwareCode(Long tenantId, String softwareCode);

    boolean existsByTenantIdAndSoftwareCode(Long tenantId, String softwareCode);
}
