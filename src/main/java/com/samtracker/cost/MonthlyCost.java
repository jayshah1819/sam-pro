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
import java.time.Instant;

// Actual monthly spend for a vendor (one row per vendor per billing month).
@Entity
@Table(name = "monthly_costs", indexes = {
        @Index(name = "idx_monthly_costs_tenant_id", columnList = "tenant_id"),
        @Index(name = "idx_monthly_costs_vendor_id", columnList = "vendor_id")
})
@Getter
@Setter
@NoArgsConstructor
public class MonthlyCost {

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

    @Column(name = "seats_billed")
    private Integer seatsBilled;

    @Column(name = "unit_price_actual", precision = 15, scale = 2)
    private BigDecimal unitPriceActual;

    @Column(name = "actual_cost", nullable = false, precision = 15, scale = 2)
    private BigDecimal actualCost;

    @Column(name = "invoice_id")
    private String invoiceId;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt = Instant.now();
}
