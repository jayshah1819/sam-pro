package com.samtracker.vendor;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface VendorRepository extends JpaRepository<Vendor, Integer> {

    Page<Vendor> findByTenantId(Long tenantId, Pageable pageable);

    Optional<Vendor> findByVendorIdAndTenantId(Integer vendorId, Long tenantId);

    Optional<Vendor> findByTenantIdAndVendorId(Long tenantId, Integer vendorId);

    boolean existsByTenantIdAndName(Long tenantId, String name);

    Optional<Vendor> findByTenantIdAndName(Long tenantId, String name);

    Page<Vendor> findByTenantIdAndNameContainingIgnoreCase(Long tenantId, String name, Pageable pageable);

    @Query("""
            SELECT v FROM Vendor v
            WHERE v.tenantId = :tenantId
                AND (:q IS NULL OR :q = ''
                    OR STR(v.vendorId) LIKE CONCAT('%', :q, '%')
                    OR LOWER(COALESCE(v.name, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(COALESCE(v.vendorJDENumber, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(COALESCE(v.canonicalName, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(COALESCE(v.contactEmail, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(COALESCE(v.website, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                    OR EXISTS (
                        SELECT c FROM Contract c
                        WHERE c.tenantId = v.tenantId
                            AND c.vendorId = v.vendorId
                            AND (STR(c.id) LIKE CONCAT('%', :q, '%')
                                OR LOWER(COALESCE(c.contractNumber, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                                OR LOWER(COALESCE(c.vendorJDENumber, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                                OR LOWER(COALESCE(c.softwareName, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                                OR LOWER(COALESCE(c.department, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                                OR EXISTS (
                                    SELECT e FROM Entitlement e
                                    WHERE e.tenantId = c.tenantId
                                        AND e.contract.id = c.id
                                        AND (STR(e.id) LIKE CONCAT('%', :q, '%')
                                            OR STR(e.softwareProduct.id) LIKE CONCAT('%', :q, '%')
                                            OR LOWER(e.softwareProduct.name) LIKE LOWER(CONCAT('%', :q, '%'))
                                            OR LOWER(e.softwareProduct.version) LIKE LOWER(CONCAT('%', :q, '%')))
                                ))
                    ))
            ORDER BY v.vendorId DESC
            """)
    Page<Vendor> searchByTenantId(@Param("tenantId") Long tenantId, @Param("q") String q, Pageable pageable);

    @Query("SELECT v.vendorId, COUNT(s) FROM Vendor v LEFT JOIN SoftwareProduct s ON s.tenantId = v.tenantId AND s.vendor = v.name WHERE v.tenantId = :tenantId GROUP BY v.vendorId")
    List<Object[]> countSoftwareByVendor(@Param("tenantId") Long tenantId);
}
