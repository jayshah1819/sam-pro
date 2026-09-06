package com.samtracker.common;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.TenantId;
import com.samtracker.tenant.TenantContext;

import java.util.UUID;

@MappedSuperclass
@Getter
@Setter
public abstract class TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // child entities must declare @Index(columnList = "tenant_id") in @Table
    @TenantId
    @Setter(AccessLevel.NONE)
    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    public Long getTenantId() {
        return tenantId != null ? tenantId : TenantContext.get();
    }
}
