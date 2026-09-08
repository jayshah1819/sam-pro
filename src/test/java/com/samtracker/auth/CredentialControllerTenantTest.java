package com.samtracker.auth;

import com.samtracker.common.EntityCodeService;
import com.samtracker.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CredentialControllerTenantTest {

    @Mock
    private CredentialRepository credentialRepository;

    @Mock
    private EntityCodeService entityCodeService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private SessionActivityService sessionActivityService;

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void roleUpdateRejectsUnknownCredential() {
        TenantContext.set(7L);
        CredentialController controller = new CredentialController(credentialRepository, entityCodeService,
                passwordEncoder, sessionActivityService);
        RoleUpdateRequest request = new RoleUpdateRequest("EDITOR");
        when(credentialRepository.findById(12L)).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> controller.updateRole(12L, request));
        verify(credentialRepository).findById(12L);
    }

    @Test
    void createPutsNewUserInCurrentTenant() {
        TenantContext.set(7L);
        CredentialController controller = new CredentialController(credentialRepository, entityCodeService,
                passwordEncoder, sessionActivityService);
        when(credentialRepository.findByUsername("new-user")).thenReturn(Optional.empty());
        when(entityCodeService.nextCode(7L, "user", "u")).thenReturn("u-100");
        when(passwordEncoder.encode("password123")).thenReturn("hashed");

        CredentialView view = controller.create(null, new CreateUserRequest("new-user", "password123", "EDITOR"));

        assertEquals(7L, view.tenantId());
        assertEquals("new-user", view.username());
        assertEquals("EDITOR", view.role());
        verify(credentialRepository).save(any(Credential.class));
    }
}