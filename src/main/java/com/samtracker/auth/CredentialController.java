package com.samtracker.auth;

import com.samtracker.common.EntityCodeService;
import com.samtracker.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping("/credentials")
@PreAuthorize("hasRole('ADMIN')")
public class CredentialController {

    private final CredentialRepository credentialRepository;
    private final EntityCodeService entityCodeService;
    private final PasswordEncoder passwordEncoder;
    private final SessionActivityService sessionActivityService;

    public CredentialController(CredentialRepository credentialRepository,
            EntityCodeService entityCodeService,
            PasswordEncoder passwordEncoder,
            SessionActivityService sessionActivityService) {
        this.credentialRepository = credentialRepository;
        this.entityCodeService = entityCodeService;
        this.passwordEncoder = passwordEncoder;
        this.sessionActivityService = sessionActivityService;
    }

    @GetMapping
    public List<CredentialView> getAll() {
        List<Credential> credentials = isAdmin() ? credentialRepository.findAll()
                : credentialRepository.findByTenantId(TenantContext.get());
        return credentials.stream()
                .map(this::toView)
                .sorted(Comparator.comparing(CredentialView::online).reversed()
                        .thenComparing(CredentialView::lastSeenAt,
                                Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(CredentialView::username, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CredentialView create(Authentication authentication, @RequestBody @Valid CreateUserRequest request) {
        String username = request.username().trim();
        if (username.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username cannot be blank");
        }
        if (credentialRepository.findByUsername(username).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already taken");
        }

        Long tenantId = currentTenantId(authentication);
        Credential credential = new Credential();
        credential.setUsername(username);
        credential.setPasswordHash(passwordEncoder.encode(request.password()));
        credential.setTenantId(tenantId);
        credential.setRole(request.role());
        credential.setUserCode(entityCodeService.nextCode(tenantId, "user", "u"));
        credentialRepository.save(credential);
        return toView(credential);
    }

    // New users join the tenant of the admin who created them
    private Long currentTenantId(Authentication authentication) {
        Long tenantId = TenantContext.get();
        if (tenantId == null && authentication != null) {
            tenantId = credentialRepository.findByUsername(authentication.getName())
                    .map(Credential::getTenantId)
                    .orElse(null);
        }
        if (tenantId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No tenant context for the current user");
        }
        return tenantId;
    }

    // Admins manage users across tenants, matching the cross-tenant listing above
    private Credential findForAdmin(Long id) {
        return credentialRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private CredentialView toView(Credential credential) {
        return new CredentialView(credential.getId(), credential.getTenantId(), credential.getUsername(),
                credential.getRole(), credential.getCreatedAt(), credential.getLastLoginAt(),
                credential.getLastSeenAt(), sessionActivityService.isOnline(credential.getLastSeenAt()));
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
        Credential cred = findForAdmin(id);
        cred.setRole(request.role());
        credentialRepository.save(cred);
    }

    @PatchMapping("/{id}/username")
    public CredentialView updateUsername(@PathVariable Long id, @RequestBody @Valid UsernameUpdateRequest request) {
        Credential credential = findForAdmin(id);

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
        return toView(credential);
    }

    @PatchMapping("/{id}/password")
    public void updatePassword(@PathVariable Long id, @RequestBody @Valid PasswordUpdateRequest request) {
        Credential credential = findForAdmin(id);

        credential.setPasswordHash(passwordEncoder.encode(request.password()));
        credentialRepository.save(credential);
    }
}
