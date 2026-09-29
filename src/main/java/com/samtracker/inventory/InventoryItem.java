package com.samtracker.inventory;

import com.samtracker.tenant.TenantContext;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

import java.math.BigDecimal;

@Entity
@Table(name = "inventory_item", indexes = {
        @Index(name = "idx_inventory_item_tenant_id", columnList = "tenant_id"),
        @Index(name = "idx_inventory_item_software_code", columnList = "software_code")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uq_inventory_item_software_code", columnNames = { "tenant_id", "software_code" })
})
@Getter
@Setter
@NoArgsConstructor
public class InventoryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "inventory_item_id")
    private Long id;

    @TenantId
    @Setter(AccessLevel.NONE)
    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    public Long getTenantId() {
        return tenantId != null ? tenantId : TenantContext.get();
    }

    @Column(name = "company_group")
    private String companyGroup;

    @Column(name = "company_name_division")
    private String companyNameDivision;

    @Column(name = "system_functionality")
    private String systemFunctionality;

    @Column(name = "manufacturer_name")
    private String manufacturerName;

    @Column(name = "vendor_name")
    private String vendorName;

    @Column(name = "software_name")
    private String softwareName;

    @Column(name = "total_software_spend", precision = 15, scale = 2)
    private BigDecimal totalSoftwareSpend;

    @Column(name = "currency")
    private String currency;

    @Column(name = "software_code", nullable = false)
    private String softwareCode;

    @Column(columnDefinition = "text")
    private String comments;
}
