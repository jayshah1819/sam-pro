package com.samtracker.software;

import com.samtracker.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
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
        return repository.findByTenantId(TenantContext.get(), capped(pageable, 500));
    }

    public Page<SoftwareProduct> findByVendorName(String vendorName, Pageable pageable) {
        return repository.findPageByTenantIdAndVendor(TenantContext.get(), vendorName, capped(pageable, 500));
    }

    public List<VendorSoftwareSummary> findVendorSummary() {
        return repository.countByVendorForTenant(TenantContext.get()).stream()
                .map(row -> new VendorSoftwareSummary((String) row[0], (Long) row[1]))
                .toList();
    }

    public long countVendorsBySoftwareName(String name) {
        String value = name == null ? "" : name.strip();
        return value.isEmpty() ? 0 : repository.countDistinctVendorsBySoftwareName(TenantContext.get(), value);
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
}
