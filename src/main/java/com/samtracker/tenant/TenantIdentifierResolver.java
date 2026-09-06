package com.samtracker.tenant;

import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.stereotype.Component;

// must implement <Object> to match Spring Boot's CurrentTenantIdentifierResolver<Object> injection point
@Component
public class TenantIdentifierResolver implements CurrentTenantIdentifierResolver<Object> {

    // Matches no real tenant; used when no authenticated context is present
    private static final Long SYSTEM_TENANT = 0L;

    @Override
    public Object resolveCurrentTenantIdentifier() {
        Long tenantId = TenantContext.get();
        return tenantId != null ? tenantId : SYSTEM_TENANT;
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        return false;
    }
}
