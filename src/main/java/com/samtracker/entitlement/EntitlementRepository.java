package com.samtracker.entitlement;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface EntitlementRepository extends JpaRepository<Entitlement, Integer> {

    Page<Entitlement> findByTenantId(Long tenantId, Pageable pageable);

    List<Entitlement> findByTenantIdAndSoftwareProduct_Id(Long tenantId, Integer softwareProductId);

    List<Entitlement> findByTenantIdAndContract_Id(Long tenantId, Integer contractId);

    List<Entitlement> findByTenantIdAndSoftwareProduct_VendorIgnoreCase(Long tenantId, String vendor);

    @Query("select distinct e.contract.id, e.softwareProduct.id "
            + "from Entitlement e where e.tenantId = :tenantId and e.contract.id in :contractIds")
    List<Object[]> findSoftwareIdsByContractIds(@Param("tenantId") Long tenantId,
            @Param("contractIds") List<Integer> contractIds);

    java.util.Optional<Entitlement> findByTenantIdAndId(Long tenantId, Integer id);
}
