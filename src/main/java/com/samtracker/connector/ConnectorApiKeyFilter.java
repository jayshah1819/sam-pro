package com.samtracker.connector;

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

/**
 * Lets Power Apps / Copilot Studio call the read-only /connector/** API with a static
 * X-API-Key instead of a 24h JWT. The key maps to a fixed tenant and the VIEWER role.
 */
public class ConnectorApiKeyFilter extends OncePerRequestFilter {

    private final byte[] apiKey;
    private final Long tenantId;

    public ConnectorApiKeyFilter(String apiKey, Long tenantId) {
        this.apiKey = apiKey == null ? new byte[0] : apiKey.getBytes(StandardCharsets.UTF_8);
        this.tenantId = tenantId;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/connector/") || request.getHeader("X-API-Key") == null;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
            @NonNull FilterChain chain) throws ServletException, IOException {
        byte[] provided = request.getHeader("X-API-Key").getBytes(StandardCharsets.UTF_8);
        if (apiKey.length < 24 || !MessageDigest.isEqual(apiKey, provided)) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid API key");
            return;
        }
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "connector", null, List.of(new SimpleGrantedAuthority("ROLE_VIEWER"))));
        TenantContext.set(tenantId);
        try {
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}
