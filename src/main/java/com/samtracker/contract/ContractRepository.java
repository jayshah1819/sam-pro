package com.samtracker.contract;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.math.BigDecimal;

public interface ContractRepository extends JpaRepository<Contract, Integer> {

    @Query(value = "SELECT DISTINCT tenant_id FROM contracts ORDER BY tenant_id", nativeQuery = true)
    List<Long> findDistinctTenantIdsWithContracts();

    @Query(value = "SELECT tenant_id FROM contracts WHERE contract_id = :contractId LIMIT 1", nativeQuery = true)
    Optional<Long> findTenantIdByContractId(@Param("contractId") Integer contractId);

    Page<Contract> findByTenantId(Long tenantId, Pageable pageable);

    // Returns contracts whose end date falls before the given date for the
    // specified tenant
    @Query("SELECT c FROM Contract c WHERE c.tenantId = :tenantId AND c.endDate < :date")
    List<Contract> findExpiringBefore(@Param("tenantId") Long tenantId, @Param("date") LocalDate date);

    // YTD: contracts still active on or after the first day of the current year
    @Query("SELECT c FROM Contract c WHERE c.tenantId = :tenantId AND c.endDate >= :yearStart ORDER BY c.endDate")
    Page<Contract> findYtd(@Param("tenantId") Long tenantId, @Param("yearStart") LocalDate yearStart,
            Pageable pageable);

    @Query("SELECT c FROM Contract c WHERE c.tenantId = :tenantId AND c.vendorId = :vendorId AND c.endDate >= :yearStart ORDER BY c.endDate")
    Page<Contract> findYtdByVendor(
            @Param("tenantId") Long tenantId,
            @Param("vendorId") Integer vendorId,
            @Param("yearStart") LocalDate yearStart,
            Pageable pageable);

    long countByTenantId(Long tenantId);

    Page<Contract> findByTenantIdAndVendorId(Long tenantId, Integer vendorId, Pageable pageable);

    Optional<Contract> findByIdAndTenantId(Integer id, Long tenantId);

    Optional<Contract> findByTenantIdAndContractNumberAndVendorName(Long tenantId, String contractNumber,
            String vendorName);

    @Query("""
            SELECT c FROM Contract c
            WHERE c.tenantId = :tenantId
                      AND (:q IS NULL OR :q = '' OR LOWER(c.contractNumber) LIKE LOWER(CONCAT('%', :q, '%'))
                          OR STR(c.id) LIKE CONCAT('%', :q, '%')
                          OR STR(c.vendorId) LIKE CONCAT('%', :q, '%')
                          OR LOWER(COALESCE(c.vendorName, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                          OR LOWER(COALESCE(c.vendorJDENumber, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                          OR LOWER(COALESCE(c.softwareName, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                          OR EXISTS (
                              SELECT e FROM Entitlement e
                              WHERE e.tenantId = c.tenantId
                                  AND e.contract.id = c.id
                                  AND (STR(e.id) LIKE CONCAT('%', :q, '%')
                                      OR STR(e.softwareProduct.id) LIKE CONCAT('%', :q, '%')
                                      OR LOWER(e.softwareProduct.name) LIKE LOWER(CONCAT('%', :q, '%'))
                                      OR LOWER(e.softwareProduct.version) LIKE LOWER(CONCAT('%', :q, '%')))
                          ))
              AND (:vendorId IS NULL OR c.vendorId = :vendorId)
              AND (:status IS NULL OR c.status = :status)
              AND (:startDate IS NULL OR c.startDate >= :startDate)
              AND (:endDate IS NULL OR c.startDate <= :endDate)
              AND (:minValue IS NULL OR c.value >= :minValue)
              AND (:maxValue IS NULL OR c.value <= :maxValue)
            ORDER BY c.startDate DESC
            """)
    Page<Contract> findFiltered(
            @Param("tenantId") Long tenantId,
            @Param("q") String q,
            @Param("vendorId") Integer vendorId,
            @Param("status") ContractStatus status,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("minValue") BigDecimal minValue,
            @Param("maxValue") BigDecimal maxValue,
            Pageable pageable);

    @Query("""
            SELECT c FROM Contract c
                  WHERE (:q IS NULL OR :q = '' OR LOWER(c.contractNumber) LIKE LOWER(CONCAT('%', :q, '%'))
                      OR STR(c.id) LIKE CONCAT('%', :q, '%')
                      OR STR(c.vendorId) LIKE CONCAT('%', :q, '%')
                      OR LOWER(COALESCE(c.vendorName, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                      OR LOWER(COALESCE(c.vendorJDENumber, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                      OR LOWER(COALESCE(c.softwareName, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                      OR EXISTS (
                          SELECT e FROM Entitlement e
                          WHERE e.tenantId = c.tenantId
                              AND e.contract.id = c.id
                              AND (STR(e.id) LIKE CONCAT('%', :q, '%')
                                  OR STR(e.softwareProduct.id) LIKE CONCAT('%', :q, '%')
                                  OR LOWER(e.softwareProduct.name) LIKE LOWER(CONCAT('%', :q, '%'))
                                  OR LOWER(e.softwareProduct.version) LIKE LOWER(CONCAT('%', :q, '%')))
                      ))
              AND (:vendorId IS NULL OR c.vendorId = :vendorId)
              AND (:status IS NULL OR c.status = :status)
              AND (:startDate IS NULL OR c.startDate >= :startDate)
              AND (:endDate IS NULL OR c.startDate <= :endDate)
              AND (:minValue IS NULL OR c.value >= :minValue)
              AND (:maxValue IS NULL OR c.value <= :maxValue)
            ORDER BY c.startDate DESC
            """)
    Page<Contract> findFilteredAll(
            @Param("q") String q,
            @Param("vendorId") Integer vendorId,
            @Param("status") ContractStatus status,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("minValue") BigDecimal minValue,
            @Param("maxValue") BigDecimal maxValue,
            Pageable pageable);

    @Query("""
            SELECT c FROM Contract c
            WHERE c.tenantId = :tenantId
                      AND (:q IS NULL OR :q = '' OR LOWER(c.contractNumber) LIKE LOWER(CONCAT('%', :q, '%'))
                          OR STR(c.id) LIKE CONCAT('%', :q, '%')
                          OR STR(c.vendorId) LIKE CONCAT('%', :q, '%')
                          OR LOWER(COALESCE(c.vendorName, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                          OR LOWER(COALESCE(c.vendorJDENumber, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                          OR LOWER(COALESCE(c.softwareName, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                          OR EXISTS (
                              SELECT e FROM Entitlement e
                              WHERE e.tenantId = c.tenantId
                                  AND e.contract.id = c.id
                                  AND (STR(e.id) LIKE CONCAT('%', :q, '%')
                                      OR STR(e.softwareProduct.id) LIKE CONCAT('%', :q, '%')
                                      OR LOWER(e.softwareProduct.name) LIKE LOWER(CONCAT('%', :q, '%'))
                                      OR LOWER(e.softwareProduct.version) LIKE LOWER(CONCAT('%', :q, '%')))
                          ))
              AND (:vendorId IS NULL OR c.vendorId = :vendorId)
              AND (:status IS NULL OR c.status = :status)
              AND (:startDate IS NULL OR c.startDate >= :startDate)
              AND (:endDate IS NULL OR c.startDate <= :endDate)
              AND (:minValue IS NULL OR c.value >= :minValue)
              AND (:maxValue IS NULL OR c.value <= :maxValue)
            ORDER BY c.startDate DESC
            """)
    List<Contract> findFilteredForExport(
            @Param("tenantId") Long tenantId,
            @Param("q") String q,
            @Param("vendorId") Integer vendorId,
            @Param("status") ContractStatus status,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("minValue") BigDecimal minValue,
            @Param("maxValue") BigDecimal maxValue);
}
