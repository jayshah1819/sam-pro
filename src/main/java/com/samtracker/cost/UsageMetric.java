package com.samtracker.cost;

import com.samtracker.tenant.TenantContext;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

import java.math.BigDecimal;
import java.time.LocalDate;

// Usage-based spend for a vendor (e.g. cloud/API consumption) for a billing month.
@Entity
@Table(name = "usage_metrics", indexes = {
        @Index(name = "idx_usage_metrics_tenant_id", columnList = "tenant_id"),
        @Index(name = "idx_usage_metrics_vendor_id", columnList = "vendor_id")
})
@Getter
@Setter
@NoArgsConstructor
public class UsageMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "record_id")
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

    // First day of the billed month.
    @Column(name = "billing_month", nullable = false)
    private LocalDate billingMonth;

    @Column(name = "usage_units", precision = 18, scale = 4)
    private BigDecimal usageUnits;

    @Column(name = "unit_cost", precision = 15, scale = 4)
    private BigDecimal unitCost;
}
