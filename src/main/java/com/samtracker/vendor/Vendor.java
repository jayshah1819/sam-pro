package com.samtracker.vendor;

import com.samtracker.common.StringListConverter;
import com.samtracker.tenant.TenantContext;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "vendors", indexes = @Index(name = "idx_vendors_tenant_id", columnList = "tenant_id"))
@Getter
@Setter
@NoArgsConstructor
public class Vendor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "vendor_id")
    private Integer vendorId;

    @TenantId
    @Setter(AccessLevel.NONE)
    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    public Long getTenantId() {
        return tenantId != null ? tenantId : TenantContext.get();
    }

    public void assignTenantId(Long tenantId) {
        this.tenantId = tenantId;
    }

    @Column(nullable = false)
    private String name;

    @Column(name = "vendor_jde_number")
    private String vendorJDENumber;

    @Column(name = "canonical_name")
    private String canonicalName;

    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "text")
    private List<String> aliases = new ArrayList<>();

    @Column(name = "contact_email")
    private String contactEmail;

    @Column
    private String address;

    @Column
    private String website;

    @Column(columnDefinition = "text")
    private String comments;
}
