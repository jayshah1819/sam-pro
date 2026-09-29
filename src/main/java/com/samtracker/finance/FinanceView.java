package com.samtracker.finance;

import com.samtracker.tenant.TenantContext;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

import java.math.BigDecimal;

// Finance rollup row (software cost/TCO view) shown on the Finance "Detailed" tab.
// One software can have several rows here (one per Cost Code line item, e.g. the
// source "Detailed"/"Other Software" import sheets list the same software against
// multiple cost codes) — the natural key is (tenant, software_code, cost_code),
// not software_code alone, so the primary key is a surrogate id.
@Entity
@Table(name = "finance_view", indexes = {
        @Index(name = "idx_finance_view_tenant_id", columnList = "tenant_id"),
        @Index(name = "idx_finance_view_vendor_id", columnList = "vendor_id"),
        @Index(name = "idx_finance_view_software_code", columnList = "software_code")
})
@Getter
@Setter
@NoArgsConstructor
public class FinanceView {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Business key from the source spreadsheet, not unique alone — see class comment.
    @Column(name = "software_code", nullable = false)
    private String softwareCode;

    @TenantId
    @Setter(AccessLevel.NONE)
    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    public Long getTenantId() {
        return tenantId != null ? tenantId : TenantContext.get();
    }

    @Column(name = "source_budget")
    private String sourceBudget;

    @Column(name = "primary_category")
    private String primaryCategory;

    @Column(name = "sub_category")
    private String subCategory;

    @Column(name = "business_criticality")
    private String businessCriticality;

    @Column(name = "strategy")
    private String strategy;

    @Column(name = "erp")
    private String erp;

    @Column(name = "cost_code")
    private String costCode;

    @Column(name = "location")
    private String location;

    @Column(name = "vendor_id")
    private Integer vendorId;

    @Column(name = "software_name")
    private String softwareName;

    @Column(name = "baseline_budget", precision = 15, scale = 2)
    private BigDecimal baselineBudget;

    @Column(name = "software_spend", precision = 15, scale = 2)
    private BigDecimal softwareSpend;

    @Column(name = "actuals", precision = 15, scale = 2)
    private BigDecimal actuals;

    @Column(name = "remaining", precision = 15, scale = 2)
    private BigDecimal remaining;

    @Column(name = "managed_service_providers", precision = 15, scale = 2)
    private BigDecimal managedServiceProviders;

    @Column(name = "it_staff_internal_labour", precision = 15, scale = 2)
    private BigDecimal itStaffInternalLabour;

    @Column(name = "it_staff_external_labour", precision = 15, scale = 2)
    private BigDecimal itStaffExternalLabour;

    @Column(name = "depreciation_amortisation", precision = 15, scale = 2)
    private BigDecimal depreciationAmortisation;

    @Column(name = "cloud_solutions", precision = 15, scale = 2)
    private BigDecimal cloudSolutions;

    @Column(name = "consulting_outside_services", precision = 15, scale = 2)
    private BigDecimal consultingOutsideServices;

    @Column(name = "total_tco", precision = 15, scale = 2)
    private BigDecimal totalTco;

    @Column(name = "cost_recoveries", precision = 15, scale = 2)
    private BigDecimal costRecoveries;
}
