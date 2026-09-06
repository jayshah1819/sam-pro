package com.samtracker.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;

@Service
public class JwtService {

    private final SecretKey signingKey;
    private final long expirationMs;

    public JwtService(JwtProperties props) {
        this.signingKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(props.getSecret()));
        this.expirationMs = props.getExpirationMs();
    }

    public String generateToken(String subject, Long tenantId, String role) {
        return Jwts.builder()
                .subject(subject)
                .claim("tenantId", tenantId.toString())
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(signingKey)
                .compact();
    }

    public String extractSubject(String token) {
        return extractAllClaims(token).getSubject();
    }

    public Long extractTenantId(String token) {
        String value = extractAllClaims(token).get("tenantId", String.class);
        return value != null ? Long.parseLong(value) : null;
    }

    public String extractRole(String token) {
        String value = extractAllClaims(token).get("role", String.class);
        return value != null ? value : "VIEWER";
    }

    public boolean isTokenValid(String token) {
        try {
            extractAllClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
