package com.samtracker.security;

import com.samtracker.auth.Credential;
import com.samtracker.auth.CredentialRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final JwtService jwtService;
    private final CredentialRepository credentialRepository;

    public JwtAuthenticationFilter(JwtService jwtService, CredentialRepository credentialRepository) {
        this.jwtService = jwtService;
        this.credentialRepository = credentialRepository;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain chain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            String fallbackToken = request.getHeader("X-SAM-Tracker-Token");
            if (fallbackToken != null && !fallbackToken.isBlank()) {
                authHeader = "Bearer " + fallbackToken;
            }
        }
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        if (!jwtService.isTokenValid(token)) {
            log.warn("Rejected request {} {}: invalid JWT", request.getMethod(), request.getRequestURI());
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid token");
            return;
        }
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            Long tenantId = jwtService.extractTenantId(token);
            if (tenantId == null) {
                log.warn("Rejected request {} {}: JWT tenantId is missing", request.getMethod(),
                        request.getRequestURI());
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid token: tenantId is missing");
                return;
            }
            String subject = jwtService.extractSubject(token);
            Credential credential = credentialRepository.findByUsername(subject).orElse(null);
            if (credential == null || !tenantId.equals(credential.getTenantId())) {
                log.warn("Rejected request {} {}: JWT subject/tenant mismatch for subject '{}' and tenant '{}'",
                        request.getMethod(), request.getRequestURI(), subject, tenantId);
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid token subject");
                return;
            }
            String role = credential.getRole();
            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(subject, null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + role)));
            auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(auth);
        }

        chain.doFilter(request, response);
    }
}
