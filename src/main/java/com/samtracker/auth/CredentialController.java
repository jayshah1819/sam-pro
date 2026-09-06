package com.samtracker.auth;

import com.samtracker.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/credentials")
@PreAuthorize("hasRole('ADMIN')")
public class CredentialController {

    private final CredentialRepository credentialRepository;

    public CredentialController(CredentialRepository credentialRepository) {
        this.credentialRepository = credentialRepository;
    }

    @GetMapping
    public List<CredentialView> getAll() {
        Long tenantId = TenantContext.get();
        return credentialRepository.findByTenantId(tenantId).stream()
                .map(c -> {
                    return new CredentialView(c.getId(), tenantId, c.getUsername(), c.getRole(),
                            c.getCreatedAt());
                })
                .toList();
    }

    @PatchMapping("/{id}/role")
    public void updateRole(@PathVariable Long id, @RequestBody @Valid RoleUpdateRequest request) {
        Credential cred = credentialRepository.findByIdAndTenantId(id, TenantContext.get())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        cred.setRole(request.role());
        credentialRepository.save(cred);
    }
}
