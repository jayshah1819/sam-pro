package com.samtracker.common;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
public class EntityCodeService {

    private static final long DEFAULT_START = 100;
    // Per-entity starting values so each entity type's numbering range is distinct
    private static final Map<String, Long> START_VALUES = Map.of(
            "user", 100L,
            "vendor_id", 400L,
            "software_id", 900L,
            "license_id", 900L,
            "contract", 200L);

    private final EntityCodeCounterRepository counterRepository;

    public EntityCodeService(EntityCodeCounterRepository counterRepository) {
        this.counterRepository = counterRepository;
    }

    @Transactional
    public synchronized String nextCode(Long tenantId, String entityKey, String prefix) {
        return prefix + "-" + nextValue(tenantId, entityKey);
    }

    // Plain consecutive number with no prefix (e.g. 200, 201, 202...)
    @Transactional
    public synchronized String nextPlainNumber(Long tenantId, String entityKey) {
        return String.valueOf(nextValue(tenantId, entityKey));
    }

    private long nextValue(Long tenantId, String entityKey) {
        long start = START_VALUES.getOrDefault(entityKey, DEFAULT_START);
        EntityCodeCounter counter = counterRepository.findByTenantIdAndEntityKey(tenantId, entityKey)
                .orElseGet(() -> {
                    EntityCodeCounter created = new EntityCodeCounter();
                    created.setTenantId(tenantId);
                    created.setEntityKey(entityKey);
                    created.setNextValue(start);
                    return created;
                });

        long current = counter.getNextValue();
        counter.setNextValue(current + 1);
        counterRepository.save(counter);
        return current;
    }
}
