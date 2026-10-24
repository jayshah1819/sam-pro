package com.samtracker.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samtracker.integration.IntegrationDtos.ErrorResponse;
import com.samtracker.tenant.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/** Authenticates /api/v1/** requests with the X-API-Key header and pins them to one tenant, read-only role. */
public class IntegrationApiKeyFilter extends OncePerRequestFilter {

    static final int MIN_KEY_LENGTH = 24;

    private final byte[] apiKey;
    private final Long tenantId;
    private final ObjectMapper objectMapper;

    public IntegrationApiKeyFilter(String apiKey, Long tenantId, ObjectMapper objectMapper) {
        this.apiKey = apiKey == null ? new byte[0] : apiKey.getBytes(StandardCharsets.UTF_8);
        this.tenantId = tenantId;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
            @NonNull FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("X-API-Key");
        boolean valid = apiKey.length >= MIN_KEY_LENGTH && header != null
                && MessageDigest.isEqual(apiKey, header.getBytes(StandardCharsets.UTF_8));
        if (!valid) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            objectMapper.writeValue(response.getOutputStream(),
                    new ErrorResponse("UNAUTHORIZED", "Missing or invalid X-API-Key"));
            return;
        }
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "integration", null, List.of(new SimpleGrantedAuthority("ROLE_VIEWER"))));
        TenantContext.set(tenantId);
        try {
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}
