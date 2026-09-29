package com.samtracker.finance;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FinanceViewRepository extends JpaRepository<FinanceView, Long> {

    List<FinanceView> findByTenantIdOrderBySoftwareCodeAsc(Long tenantId);

    // The row created/maintained by the License<->Finance sync for a given
    // software code has no cost code of its own (it represents the license's
    // own line, distinct from imported per-cost-code breakdown rows).
    Optional<FinanceView> findByTenantIdAndSoftwareCodeAndCostCodeIsNull(Long tenantId, String softwareCode);

    // MySQL sorts NULL first in ASC order, so this prefers the cost-code-less
    // "license line" row when one exists, falling back to any other row sharing
    // this software code (e.g. when only imported per-cost-code rows exist).
    // No explicit tenant filter — relies on Hibernate's @TenantId session filter,
    // matching the old single-column-PK findById(softwareCode) behavior.
    Optional<FinanceView> findFirstBySoftwareCodeOrderByCostCodeAsc(String softwareCode);

    boolean existsByTenantIdAndSoftwareCodeAndCostCode(Long tenantId, String softwareCode, String costCode);
}
