package com.samtracker.finance;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FinanceMonthlySoftwareSpendRepository extends JpaRepository<FinanceMonthlySoftwareSpend, Long> {

    Optional<FinanceMonthlySoftwareSpend> findByTenantIdAndSoftwareCodeAndYearAndMonth(
            Long tenantId, String softwareCode, Integer year, Integer month);
}
