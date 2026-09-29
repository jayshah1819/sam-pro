package com.samtracker.finance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FinanceMonthlyActualRepository extends JpaRepository<FinanceMonthlyActual, Long> {

    Optional<FinanceMonthlyActual> findByTenantIdAndSoftwareCodeAndYearAndMonth(
            Long tenantId, String softwareCode, Integer year, Integer month);

    @Query("select f.softwareCode as softwareCode, f.amount as amount from FinanceMonthlyActual f " +
            "where f.tenantId = :tenantId and f.year = :year and f.month = :month")
    List<SoftwareCodeAmount> findAmountsForMonth(
            @Param("tenantId") Long tenantId, @Param("year") Integer year, @Param("month") Integer month);

    @Query("select f.softwareCode as softwareCode, f.month as month, f.amount as amount from FinanceMonthlyActual f " +
            "where f.tenantId = :tenantId and f.year = :year")
    List<SoftwareCodeMonthAmount> findAmountsForYear(@Param("tenantId") Long tenantId, @Param("year") Integer year);
}
