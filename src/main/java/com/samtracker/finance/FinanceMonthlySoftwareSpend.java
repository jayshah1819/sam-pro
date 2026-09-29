package com.samtracker.finance;

import com.samtracker.tenant.TenantContext;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

import java.math.BigDecimal;

// One editable Software Spend entry per software per calendar month, normally
// auto-rolled-forward from the prior month's recorded Actuals.
@Entity
@Table(name = "finance_monthly_software_spend", indexes = {
        @Index(name = "idx_finance_monthly_software_spend_tenant_id", columnList = "tenant_id"),
        @Index(name = "idx_finance_monthly_software_spend_software_code", columnList = "software_code")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uq_finance_monthly_software_spend", columnNames = { "tenant_id", "software_code",
                "year", "month" })
})
@Getter
@Setter
@NoArgsConstructor
public class FinanceMonthlySoftwareSpend {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "finance_monthly_software_spend_id")
    private Long id;

    @TenantId
    @Setter(AccessLevel.NONE)
    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    public Long getTenantId() {
        return tenantId != null ? tenantId : TenantContext.get();
    }

    @Column(name = "software_code", nullable = false)
    private String softwareCode;

    @Column(name = "year", nullable = false)
    private Integer year;

    // 1 (January) through 12 (December).
    @Column(name = "month", nullable = false)
    private Integer month;

    @Column(name = "amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;
}
