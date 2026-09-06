package com.samtracker.entitlement;

import com.samtracker.contract.Contract;
import com.samtracker.software.SoftwareProduct;
import com.samtracker.tenant.TenantContext;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

import java.time.LocalDate;
import java.math.BigDecimal;

@Entity
@Table(name = "entitlements", indexes = {
        @Index(name = "idx_entitlements_tenant_id", columnList = "tenant_id"),
        @Index(name = "idx_entitlements_software_id", columnList = "software_id"),
        @Index(name = "idx_entitlements_contract_id", columnList = "contract_id")
})
@Getter
@Setter
@NoArgsConstructor
public class Entitlement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "license_id")
    private Integer id;

    @TenantId
    @Setter(AccessLevel.NONE)
    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    public Long getTenantId() {
        return tenantId != null ? tenantId : TenantContext.get();
    }

    public Integer getLicenseId() {
        return id;
    }

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "software_id", nullable = false)
    private SoftwareProduct softwareProduct;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id")
    private Contract contract;

    @Column(name = "license_name", nullable = false)
    private String licenseName;

    @Column(columnDefinition = "text")
    private String comments;

    @Column(name = "it_owner")
    private String itOwner;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private LicenseStatus status = LicenseStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false)
    private PaymentMethod paymentMethod = PaymentMethod.PURCHASE_ORDER;

    @Enumerated(EnumType.STRING)
    @Column(name = "license_type", nullable = false)
    private LicenseType licenseType;

    // Null is valid for license types that are not seat-based (e.g. SITE_LICENSE)
    @Column(name = "seats_purchased")
    private Integer seatsPurchased;

    @Column(precision = 15, scale = 2)
    private BigDecimal price;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "expiry_date", nullable = false)
    private LocalDate expiryDate;
}
