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

    @Column(name = "business_owner")
    private String businessOwner;

    // Only used for standalone licenses (no contract); contract-linked licenses
    // derive department from Contract.location
    @Column(name = "location")
    private String location;

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

    // Ties this license to Finance's Detailed tab row (finance_view.software_code)
    // so budget figures can flow through, and to a Vendor's public id directly
    // (rather than only the vendor-name match used by the pre-existing software
    // relation above) — additive columns, the software_id/contract linkage above
    // is unchanged so existing rollups keep working.
    @Column(name = "software_code")
    private String softwareCode;

    @Column(name = "vendor_id")
    private Integer vendorId;

    @Column(name = "functional_grouping")
    private String functionalGrouping;

    @Column(name = "functional_owner")
    private String functionalOwner;

    @Column(name = "confidence_level")
    private String confidenceLevel;

    @Column(name = "manufacturer_name")
    private String manufacturerName;

    @Column(name = "system_category")
    private String systemCategory;

    @Column(name = "system_categorization")
    private String systemCategorization;

    @Column(name = "business_criticality")
    private String businessCriticality;

    @Column(name = "system_strategy")
    private String systemStrategy;

    @Column(name = "erp_system")
    private String erpSystem;

    @Column(name = "annual_infrastructure_cost", precision = 15, scale = 2)
    private BigDecimal annualInfrastructureCost;

    @Column(name = "annual_cost_non_license", precision = 15, scale = 2)
    private BigDecimal annualCostNonLicense;

    @Column(name = "annual_license_cost", precision = 15, scale = 2)
    private BigDecimal annualLicenseCost;

    @Column(name = "annual_cost_total", precision = 15, scale = 2)
    private BigDecimal annualCostTotal;

    @Column(name = "acs_budget", precision = 15, scale = 2)
    private BigDecimal acsBudget;

    @Column(name = "number_of_active_users")
    private Integer numberOfActiveUsers;

    @Column(name = "number_of_licenses_owned")
    private Integer numberOfLicensesOwned;

    @Column(name = "proposed_function_group_owner")
    private String proposedFunctionGroupOwner;

    @Column(name = "billing_vendor")
    private String billingVendor;

    @Column(name = "billing_vendor_id")
    private Integer billingVendorId;

    @Column(name = "business_function")
    private String businessFunction;

    @Column(name = "number_of_users")
    private Integer numberOfUsers;

    @Column(name = "budget_owner")
    private String budgetOwner;

    @Column(name = "primary_it_group")
    private String primaryItGroup;

    @Column(name = "primary_it_group_leadership")
    private String primaryItGroupLeadership;

    @Column(name = "contract_duration")
    private String contractDuration;

    @Column(name = "payment_schedule")
    private String paymentSchedule;

    @Column(name = "currency")
    private String currency;

    @Column(name = "criticality_levels")
    private String criticalityLevels;

    @Column(name = "description", columnDefinition = "text")
    private String description;
}
