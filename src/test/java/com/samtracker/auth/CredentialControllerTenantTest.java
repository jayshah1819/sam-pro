package com.samtracker.auth;

import com.samtracker.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CredentialControllerTenantTest {

    @Mock
    private CredentialRepository credentialRepository;

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void roleUpdateLooksUpCredentialInsideCurrentTenant() {
        TenantContext.set(7L);
        CredentialController controller = new CredentialController(credentialRepository);
        RoleUpdateRequest request = new RoleUpdateRequest("EDITOR");
        when(credentialRepository.findByIdAndTenantId(12L, 7L)).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> controller.updateRole(12L, request));
        verify(credentialRepository).findByIdAndTenantId(12L, 7L);
    }
}