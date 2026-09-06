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
import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

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
            chain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        if (!jwtService.isTokenValid(token)) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid token");
            return;
        }
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            Long tenantId = jwtService.extractTenantId(token);
            if (tenantId == null) {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid token: tenantId is missing");
                return;
            }
            String subject = jwtService.extractSubject(token);
            Credential credential = credentialRepository.findByUsername(subject).orElse(null);
            if (credential == null || !tenantId.equals(credential.getTenantId())) {
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
