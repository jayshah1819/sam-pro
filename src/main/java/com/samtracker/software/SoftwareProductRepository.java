package com.samtracker.software;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SoftwareProductRepository extends JpaRepository<SoftwareProduct, Integer> {

        Page<SoftwareProduct> findByTenantId(Long tenantId, Pageable pageable);

        List<SoftwareProduct> findByTenantIdAndVendor(Long tenantId, String vendor);

        List<SoftwareProduct> findByTenantIdAndNameAndVersion(Long tenantId, String name, String version);

        boolean existsByTenantIdAndNameAndVendorAndVersion(Long tenantId, String name, String vendor, String version);

        @Query("SELECT s FROM SoftwareProduct s WHERE s.tenantId = :tenantId AND s.vendor = :vendor")
        Page<SoftwareProduct> findPageByTenantIdAndVendor(
                        @Param("tenantId") Long tenantId, @Param("vendor") String vendor, Pageable pageable);

        @Query("SELECT s.vendor, COUNT(s) FROM SoftwareProduct s WHERE s.tenantId = :tenantId GROUP BY s.vendor ORDER BY COUNT(s) DESC")
        List<Object[]> countByVendorForTenant(@Param("tenantId") Long tenantId);

        @Query("SELECT COUNT(DISTINCT s.vendor) FROM SoftwareProduct s WHERE s.tenantId = :tenantId AND LOWER(s.name) = LOWER(:softwareName)")
        long countDistinctVendorsBySoftwareName(@Param("tenantId") Long tenantId,
                        @Param("softwareName") String softwareName);

        Page<SoftwareProduct> findByVendor(String vendor, Pageable pageable);

        @Query("SELECT s.vendor, COUNT(s) FROM SoftwareProduct s GROUP BY s.vendor ORDER BY COUNT(s) DESC")
        List<Object[]> countByVendorAcrossTenants();

        @Query("SELECT COUNT(DISTINCT s.vendor) FROM SoftwareProduct s WHERE LOWER(s.name) = LOWER(:softwareName)")
        long countDistinctVendorsBySoftwareNameAcrossTenants(@Param("softwareName") String softwareName);
}
