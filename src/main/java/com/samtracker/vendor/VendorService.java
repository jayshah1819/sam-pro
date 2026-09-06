package com.samtracker.vendor;

import com.samtracker.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class VendorService {
    private final VendorRepository vendorRepository;
    private final EntityManager entityManager;

    public VendorService(VendorRepository vendorRepository, EntityManager entityManager) {
        this.vendorRepository = vendorRepository;
        this.entityManager = entityManager;
    }

    public Page<Vendor> findAll(Pageable pageable) {
        Pageable capped = PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 500),
                pageable.getSort());
        return vendorRepository.findByTenantId(TenantContext.get(), capped);
    }

    public Page<Vendor> findByNameContains(String name, Pageable pageable) {
        Pageable capped = PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 500),
                pageable.getSort());
        return vendorRepository.searchByTenantId(TenantContext.get(), name == null ? "" : name.trim(), capped);
    }

    public Vendor findById(Integer vendorId) {
        return vendorRepository.findByTenantIdAndVendorId(TenantContext.get(), vendorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendor not found"));
    }

    public Vendor create(Vendor vendor) {
        Vendor saved = vendorRepository.saveAndFlush(vendor);
        entityManager.clear();
        return vendorRepository.findById(saved.getVendorId()).orElse(saved);
    }

    public Map<Integer, Long> findSoftwareCounts() {
        return vendorRepository.countSoftwareByVendor(TenantContext.get()).stream()
                .collect(Collectors.toMap(row -> (Integer) row[0], row -> (Long) row[1]));
    }

    public List<VendorDuplicatePair> findPossibleDuplicates() {
        return List.of();
    }
}
