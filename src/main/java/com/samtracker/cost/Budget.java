package com.samtracker.cost;

import com.samtracker.tenant.TenantContext;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

import java.math.BigDecimal;

// Planned spend for a vendor for a given fiscal year.
@Entity
@Table(name = "budgets", indexes = {
        @Index(name = "idx_budgets_tenant_id", columnList = "tenant_id"),
        @Index(name = "idx_budgets_vendor_id", columnList = "vendor_id")
})
@Getter
@Setter
@NoArgsConstructor
public class Budget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "budget_id")
    private Integer id;

    @TenantId
    @Setter(AccessLevel.NONE)
    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    public Long getTenantId() {
        return tenantId != null ? tenantId : TenantContext.get();
    }

    @Column(name = "vendor_id", nullable = false)
    private Integer vendorId;

    @Column(name = "fiscal_year", nullable = false)
    private Integer fiscalYear;

    @Column(name = "budgeted_monthly_cost", precision = 15, scale = 2)
    private BigDecimal budgetedMonthlyCost;

    @Column(name = "budgeted_annual_cost", precision = 15, scale = 2)
    private BigDecimal budgetedAnnualCost;
}
