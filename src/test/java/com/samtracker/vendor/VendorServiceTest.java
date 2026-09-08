package com.samtracker.vendor;

import com.samtracker.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VendorServiceTest {

    @Mock
    private VendorRepository vendorRepository;

    @Mock
    private EntityManager entityManager;

    @InjectMocks
    private VendorService vendorService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void update_replacesEditableFields() {
        TenantContext.set(7L);
        Vendor existing = new Vendor();
        existing.setVendorId(10);
        existing.setName("Old vendor");
        existing.setVendorJDENumber("OLD-JDE");
        existing.setContactEmail("old@example.com");
        existing.setAddress("123 Old St");
        existing.setWebsite("https://old.example.com");
        existing.setComments("old comments");

        Vendor updates = new Vendor();
        updates.setName("Updated vendor");
        updates.setVendorJDENumber("NEW-JDE");
        updates.setContactEmail("new@example.com");
        updates.setAddress("456 New St");
        updates.setWebsite("https://new.example.com");
        updates.setComments("new comments");

        when(vendorRepository.findByTenantIdAndVendorId(7L, 10)).thenReturn(Optional.of(existing));
        when(vendorRepository.saveAndFlush(existing)).thenReturn(existing);
        when(vendorRepository.findById(10)).thenReturn(Optional.of(existing));

        Vendor saved = vendorService.update(10, updates);

        assertThat(saved.getName()).isEqualTo("Updated vendor");
        assertThat(saved.getVendorJDENumber()).isEqualTo("NEW-JDE");
        assertThat(saved.getContactEmail()).isEqualTo("new@example.com");
        assertThat(saved.getAddress()).isEqualTo("456 New St");
        assertThat(saved.getWebsite()).isEqualTo("https://new.example.com");
        assertThat(saved.getComments()).isEqualTo("new comments");
        verify(vendorRepository).saveAndFlush(existing);
        verify(entityManager).clear();
    }
}
