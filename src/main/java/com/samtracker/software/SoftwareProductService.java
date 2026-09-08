package com.samtracker.software;

import com.samtracker.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class SoftwareProductService {
    private final SoftwareProductRepository repository;
    private final EntityManager entityManager;

    public SoftwareProductService(SoftwareProductRepository repository, EntityManager entityManager) {
        this.repository = repository;
        this.entityManager = entityManager;
    }

    public Page<SoftwareProduct> findAll(Pageable pageable) {
        Pageable capped = capped(pageable, 500);
        return isCurrentUserAdmin() ? repository.findAll(capped) : repository.findByTenantId(TenantContext.get(), capped);
    }

    public Page<SoftwareProduct> findByVendorName(String vendorName, Pageable pageable) {
        Pageable capped = capped(pageable, 500);
        return isCurrentUserAdmin()
                ? repository.findByVendor(vendorName, capped)
                : repository.findPageByTenantIdAndVendor(TenantContext.get(), vendorName, capped);
    }

    public List<VendorSoftwareSummary> findVendorSummary() {
        List<Object[]> rows = isCurrentUserAdmin()
                ? repository.countByVendorAcrossTenants()
                : repository.countByVendorForTenant(TenantContext.get());
        return rows.stream()
                .map(row -> new VendorSoftwareSummary((String) row[0], (Long) row[1]))
                .toList();
    }

    public long countVendorsBySoftwareName(String name) {
        String value = name == null ? "" : name.strip();
        if (value.isEmpty()) {
            return 0;
        }
        return isCurrentUserAdmin()
                ? repository.countDistinctVendorsBySoftwareNameAcrossTenants(value)
                : repository.countDistinctVendorsBySoftwareName(TenantContext.get(), value);
    }

    public SoftwareProduct create(CreateSoftwareProductRequest request) {
        String name = request.name().strip();
        String vendor = request.vendor().strip();
        String version = request.version().strip();
        if (name.isEmpty() || vendor.isEmpty() || version.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name, vendor and version are required");
        }
        if (repository.existsByTenantIdAndNameAndVendorAndVersion(TenantContext.get(), name, vendor, version)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Software already exists for this tenant");
        }
        SoftwareProduct product = new SoftwareProduct();
        product.setName(name);
        product.setVendor(vendor);
        product.setVersion(version);
        SoftwareProduct saved = repository.saveAndFlush(product);
        entityManager.clear();
        return repository.findById(saved.getId()).orElse(saved);
    }

    private Pageable capped(Pageable pageable, int max) {
        return PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), max), pageable.getSort());
    }

    private boolean isCurrentUserAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}
