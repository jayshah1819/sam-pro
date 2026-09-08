package com.samtracker.auth;

import com.samtracker.common.EntityCodeService;
import com.samtracker.security.JwtService;
import com.samtracker.security.AuthRateLimiter;
import com.samtracker.tenant.Tenant;
import com.samtracker.tenant.TenantRepository;
import com.samtracker.tenant.TenantStatus;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final CredentialRepository credentialRepository;
    private final TenantRepository tenantRepository;
    private final EntityCodeService entityCodeService;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final AuthRateLimiter authRateLimiter;
    private final boolean registrationEnabled;

    public AuthController(AuthenticationManager authenticationManager,
            CredentialRepository credentialRepository,
            TenantRepository tenantRepository,
            EntityCodeService entityCodeService,
            JwtService jwtService,
            PasswordEncoder passwordEncoder,
            AuthRateLimiter authRateLimiter,
            @Value("${app.auth.registration-enabled:false}") boolean registrationEnabled) {
        this.authenticationManager = authenticationManager;
        this.credentialRepository = credentialRepository;
        this.tenantRepository = tenantRepository;
        this.entityCodeService = entityCodeService;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.authRateLimiter = authRateLimiter;
        this.registrationEnabled = registrationEnabled;
    }

    @PostMapping("/login")
    public LoginResponse login(HttpServletRequest httpRequest, @RequestBody @Valid LoginRequest request) {
        authRateLimiter.checkLogin(httpRequest, request.username());
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password()));
        } catch (AuthenticationException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        authRateLimiter.clearLogin(httpRequest, request.username());

        // tenantId sourced from DB record, never from the request
        Credential credential = credentialRepository.findByUsername(request.username())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        credential.setLastLoginAt(java.time.Instant.now());
        credentialRepository.save(credential);
        String token = jwtService.generateToken(request.username(), credential.getTenantId(), credential.getRole());
        return new LoginResponse(token);
    }

    @PatchMapping("/me/password")
    public void updateOwnPassword(Authentication authentication,
            @RequestBody @Valid ChangePasswordRequest request) {
        Credential credential = credentialRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (!passwordEncoder.matches(request.currentPassword(), credential.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }
        credential.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        credentialRepository.save(credential);
    }

    @GetMapping("/username-available")
    public Map<String, Boolean> usernameAvailable(@RequestParam String username) {
        return Map.of("available", credentialRepository.findByUsername(username.trim()).isEmpty());
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public void register(HttpServletRequest httpRequest, @RequestBody @Valid RegisterRequest request) {
        if (!registrationEnabled) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Not found");
        }
        authRateLimiter.checkRegistration(httpRequest, request.username());
        if (credentialRepository.findByUsername(request.username()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already taken");
        }

        // Each new signup gets its own tenant
        Tenant tenant = new Tenant();
        tenant.setCompanyName(request.username());
        tenant.setStatus(TenantStatus.ACTIVE);
        tenant = tenantRepository.save(tenant);

        Credential cred = new Credential();
        cred.setUsername(request.username());
        cred.setPasswordHash(passwordEncoder.encode(request.password()));
        cred.setTenantId(tenant.getId());
        // First user of a tenant is numbered u-100, then u-101, ... (per-tenant
        // counter)
        cred.setUserCode(entityCodeService.nextCode(tenant.getId(), "user", "u"));
        cred.setRole("VIEWER");
        credentialRepository.save(cred);
    }
}
