package com.samtracker.auth;

import com.samtracker.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/credentials")
@PreAuthorize("hasRole('ADMIN')")
public class CredentialController {

    private final CredentialRepository credentialRepository;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public CredentialController(CredentialRepository credentialRepository) {
        this.credentialRepository = credentialRepository;
    }

    @GetMapping
    public List<CredentialView> getAll() {
        List<Credential> credentials = isAdmin() ? credentialRepository.findAll()
                : credentialRepository.findByTenantId(TenantContext.get());
        return credentials.stream()
                .map(c -> new CredentialView(c.getId(), c.getTenantId(), c.getUsername(), c.getRole(),
                        c.getCreatedAt(), c.getLastLoginAt()))
                .toList();
    }

    private boolean isAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    @PatchMapping("/{id}/role")
    public void updateRole(@PathVariable Long id, @RequestBody @Valid RoleUpdateRequest request) {
        Credential cred = credentialRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        cred.setRole(request.role());
        credentialRepository.save(cred);
    }

    @PatchMapping("/{id}/username")
    public CredentialView updateUsername(@PathVariable Long id, @RequestBody @Valid UsernameUpdateRequest request) {
        Credential credential = credentialRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        String nextUsername = request.username().trim();
        if (nextUsername.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username cannot be blank");
        }
        if (!nextUsername.equalsIgnoreCase(credential.getUsername())
                && credentialRepository.findByUsername(nextUsername).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already taken");
        }

        credential.setUsername(nextUsername);
        credentialRepository.save(credential);
        return new CredentialView(credential.getId(), credential.getTenantId(), credential.getUsername(),
                credential.getRole(), credential.getCreatedAt(), credential.getLastLoginAt());
    }

    @PatchMapping("/{id}/password")
    public void updatePassword(@PathVariable Long id, @RequestBody @Valid PasswordUpdateRequest request) {
        Credential credential = credentialRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        credential.setPasswordHash(passwordEncoder.encode(request.password()));
        credentialRepository.save(credential);
    }
}
