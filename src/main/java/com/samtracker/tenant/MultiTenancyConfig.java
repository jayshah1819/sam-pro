package com.samtracker.tenant;

import org.hibernate.cfg.AvailableSettings;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MultiTenancyConfig {

    private final TenantIdentifierResolver tenantIdentifierResolver;

    public MultiTenancyConfig(TenantIdentifierResolver tenantIdentifierResolver) {
        this.tenantIdentifierResolver = tenantIdentifierResolver;
    }

    @Bean
    public HibernatePropertiesCustomizer hibernateTenancyCustomizer() {
        // bypasses Spring Boot's CurrentTenantIdentifierResolver<Object> injection
        // point
        return properties -> properties.put(
                AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, tenantIdentifierResolver);
    }
}
