package com.samtracker.common;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "entity_code_counters", indexes = {
        @Index(name = "idx_entity_code_counters_tenant_id", columnList = "tenant_id")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_entity_code_counters_tenant_entity", columnNames = { "tenant_id", "entity_key" })
})
@Getter
@Setter
@NoArgsConstructor
public class EntityCodeCounter {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    @Column(name = "entity_key", nullable = false, length = 64)
    private String entityKey;

    @Column(name = "next_value", nullable = false)
    private long nextValue;
}
