package com.samtracker.contract;

import com.samtracker.tenant.TenantContext;
import com.samtracker.vendor.Vendor;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

// Contract has a database-managed human-facing integer primary key.
@Entity
@Table(name = "contracts", indexes = {
        @Index(name = "idx_contracts_tenant_id", columnList = "tenant_id"),
        @Index(name = "idx_contracts_vendor_id", columnList = "vendor_id")
})
@Getter
@Setter
@NoArgsConstructor
public class Contract {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "contract_id")
    private Integer id;

    @TenantId
    @Setter(AccessLevel.NONE)
    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    public void assignTenantId(Long tenantId) {
        this.tenantId = tenantId;
    }

    public Long getTenantId() {
        return tenantId != null ? tenantId : TenantContext.get();
    }

    @Transient
    private Vendor vendor;

    @Column(name = "vendor_id")
    private Integer vendorId;

    @Column(name = "vendor_name")
    private String vendorName;

    @Column(name = "vendor_jde_number")
    private String vendorJDENumber;

    @Column(name = "contract_number", nullable = false)
    private String contractNumber;

    @Column(name = "department")
    private String department;

    @Column(name = "it_owner")
    private String itOwner;

    @Column(name = "software_name")
    private String softwareName;

    @Column(columnDefinition = "text")
    private String comments;

    // Derived from entitlement rows because one contract can cover many software
    // products.
    @Transient
    private List<Integer> softwareIds = new ArrayList<>();

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ContractStatus status;

    @Column(precision = 15, scale = 2)
    private BigDecimal value;
}
