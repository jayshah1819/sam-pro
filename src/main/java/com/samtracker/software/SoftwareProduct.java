package com.samtracker.software;

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
@Table(name = "software_products", indexes = @Index(name = "idx_software_products_tenant_id", columnList = "tenant_id"))
@Getter
@Setter
@NoArgsConstructor
public class SoftwareProduct {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "software_id")
    private Integer id;

    @TenantId
    @Setter(AccessLevel.NONE)
    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    public Long getTenantId() {
        return tenantId != null ? tenantId : TenantContext.get();
    }

    public Integer getSoftwareId() {
        return id;
    }

    @Column(nullable = false)
    private String name;

    @Column(name = "canonical_name")
    private String canonicalName;

    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "text")
    private List<String> aliases = new ArrayList<>();

    @Column(nullable = false)
    private String vendor;

    @Column(nullable = false)
    private String version;
}
