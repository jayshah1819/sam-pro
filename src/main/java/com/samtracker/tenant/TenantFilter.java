package com.samtracker.tenant;

import com.samtracker.security.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

public class TenantFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public TenantFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        try {
            String authHeader = request.getHeader("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                String fallbackToken = request.getHeader("X-SAM-Tracker-Token");
                if (fallbackToken != null && !fallbackToken.isBlank()) {
                    authHeader = "Bearer " + fallbackToken;
                }
            }
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                if (jwtService.isTokenValid(token)) {
                    Long tenantId = jwtService.extractTenantId(token);
                    if (tenantId != null) {
                        TenantContext.set(tenantId);
                    } else {
                        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid token: tenantId is missing");
                        return;
                    }
                }
            }
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}
