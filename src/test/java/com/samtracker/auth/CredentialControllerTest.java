package com.samtracker.auth;

import com.samtracker.common.EntityCodeService;
import com.samtracker.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CredentialControllerTest {

    @Mock
    private CredentialRepository credentialRepository;

    @Mock
    private EntityCodeService entityCodeService;

    @Spy
    private PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Mock
    private SessionActivityService sessionActivityService;

    @InjectMocks
    private CredentialController credentialController;

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    void getAll_whenAdmin_returnsAllUsersAcrossTenants() {
        TenantContext.set(7L);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin", null,
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));

        Credential currentTenantUser = new Credential();
        currentTenantUser.setId(1L);
        currentTenantUser.setTenantId(7L);
        currentTenantUser.setUsername("tenant-admin");
        currentTenantUser.setRole("ADMIN");
        currentTenantUser.setCreatedAt(Instant.now());

        Credential otherTenantUser = new Credential();
        otherTenantUser.setId(2L);
        otherTenantUser.setTenantId(9L);
        otherTenantUser.setUsername("other-tenant-user");
        otherTenantUser.setRole("VIEWER");
        otherTenantUser.setCreatedAt(Instant.now());

        when(credentialRepository.findAll()).thenReturn(List.of(currentTenantUser, otherTenantUser));

        var users = credentialController.getAll();

        assertThat(users).hasSize(2);
        assertThat(users).extracting(CredentialView::tenantId).containsExactlyInAnyOrder(7L, 9L);
        verify(credentialRepository).findAll();
        verify(credentialRepository, never()).findByTenantId(anyLong());
    }

    @Test
    void getAll_whenNotAdmin_returnsOnlyCurrentTenantUsers() {
        TenantContext.set(7L);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("user", null,
                        List.of(new SimpleGrantedAuthority("ROLE_EDITOR"))));

        Credential tenantUser = new Credential();
        tenantUser.setId(3L);
        tenantUser.setTenantId(7L);
        tenantUser.setUsername("tenant-user");
        tenantUser.setRole("EDITOR");
        tenantUser.setCreatedAt(Instant.now());

        when(credentialRepository.findByTenantId(7L)).thenReturn(List.of(tenantUser));

        var users = credentialController.getAll();

        assertThat(users).hasSize(1);
        assertThat(users.get(0).username()).isEqualTo("tenant-user");
        verify(credentialRepository).findByTenantId(7L);
        verify(credentialRepository, never()).findAll();
    }

    @Test
    void updateUsername_updatesUserAcrossTenantsForAdmin() {
        TenantContext.set(7L);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin", null,
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));

        Credential credential = new Credential();
        credential.setId(12L);
        credential.setTenantId(9L);
        credential.setUsername("old-user");
        credential.setRole("VIEWER");

        when(credentialRepository.findById(12L)).thenReturn(Optional.of(credential));
        when(credentialRepository.findByUsername("new-user")).thenReturn(Optional.empty());

        credentialController.updateUsername(12L, new UsernameUpdateRequest("new-user"));

        assertThat(credential.getUsername()).isEqualTo("new-user");
        verify(credentialRepository).save(credential);
    }

    @Test
    void updatePassword_hashesAndSavesNewPassword() {
        TenantContext.set(7L);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin", null,
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));

        Credential credential = new Credential();
        credential.setId(13L);
        credential.setTenantId(9L);
        credential.setUsername("other-user");
        credential.setPasswordHash("old-hash");

        when(credentialRepository.findById(13L)).thenReturn(Optional.of(credential));

        credentialController.updatePassword(13L, new PasswordUpdateRequest("newPassword123"));

        assertThat(credential.getPasswordHash()).isNotBlank();
        assertThat(credential.getPasswordHash()).isNotEqualTo("old-hash");
        verify(credentialRepository).save(credential);
    }
}
