package com.samtracker.tenant;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "tenants")
@Getter
@Setter
@NoArgsConstructor
public class Tenant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tenant_id")
    private Long id;

    @Column(nullable = false)
    private String companyName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TenantStatus status;

    // Role of the tenant's primary/owning account (e.g. ADMIN)
    @Column(nullable = false, columnDefinition = "varchar(50) not null default 'ADMIN'")
    private String role = "ADMIN";

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
