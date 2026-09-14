package com.samtracker.software;

import com.samtracker.tenant.TenantContext;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

import java.math.BigDecimal;
import java.time.LocalDate;

// Monthly cost entry for a software product (e.g. September 2026 spend).
@Entity
@Table(name = "software_costs", indexes = {
        @Index(name = "idx_software_costs_tenant_id", columnList = "tenant_id"),
        @Index(name = "idx_software_costs_software_id", columnList = "software_id")
})
@Getter
@Setter
@NoArgsConstructor
public class SoftwareCost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cost_id")
    private Integer id;

    @TenantId
    @Setter(AccessLevel.NONE)
    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    public Long getTenantId() {
        return tenantId != null ? tenantId : TenantContext.get();
    }

    @Column(name = "software_id", nullable = false)
    private Integer softwareId;

    @Column(name = "software_name")
    private String softwareName;

    // First day of the month this cost applies to.
    @Column(name = "cost_month", nullable = false)
    private LocalDate costMonth;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(columnDefinition = "text")
    private String notes;
}
