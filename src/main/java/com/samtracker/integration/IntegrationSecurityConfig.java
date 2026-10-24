package com.samtracker.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/** Separate filter chain so the existing SecurityConfig is untouched. Only loads when integration.enabled=true. */
@Configuration
@ConditionalOnProperty(name = "integration.enabled", havingValue = "true")
public class IntegrationSecurityConfig {

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public SecurityFilterChain integrationFilterChain(HttpSecurity http, ObjectMapper objectMapper,
            @Value("${INTEGRATION_API_KEY:}") String apiKey,
            @Value("${integration.tenant-id:1}") Long tenantId) throws Exception {
        http.securityMatcher("/api/v1/**", "/v3/api-docs/**")
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
                .addFilterBefore(new IntegrationApiKeyFilter(apiKey, tenantId, objectMapper),
                        UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
