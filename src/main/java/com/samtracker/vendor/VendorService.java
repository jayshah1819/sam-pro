package com.samtracker.vendor;

import com.samtracker.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

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
        return isCurrentUserAdmin()
                ? vendorRepository.findAll(capped)
                : vendorRepository.findByTenantId(TenantContext.get(), capped);
    }

    public Page<Vendor> findByNameContains(String name, Pageable pageable) {
        Pageable capped = PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 500),
                pageable.getSort());
        if (isCurrentUserAdmin()) {
            String needle = name == null ? "" : name.trim().toLowerCase();
            List<Vendor> matches = vendorRepository.findAll().stream()
                    .filter(vendor -> needle.isBlank()
                            || String.valueOf(vendor.getVendorId()).contains(needle)
                            || vendor.getName().toLowerCase().contains(needle)
                            || (vendor.getVendorJDENumber() != null
                                    && vendor.getVendorJDENumber().toLowerCase().contains(needle))
                            || (vendor.getContactEmail() != null
                                    && vendor.getContactEmail().toLowerCase().contains(needle)))
                    .toList();
            int start = (int) Math.min(capped.getOffset(), matches.size());
            int end = Math.min(start + capped.getPageSize(), matches.size());
            return new org.springframework.data.domain.PageImpl<>(matches.subList(start, end), capped,
                    matches.size());
        }
        return vendorRepository.searchByTenantId(TenantContext.get(), name == null ? "" : name.trim(), capped);
    }

    public Vendor findById(Integer vendorId) {
        if (isCurrentUserAdmin()) {
            Long targetTenant = resolveVendorTenant(vendorId);
            if (targetTenant == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendor not found");
            }
            return vendorRepository.findByTenantIdAndVendorId(targetTenant, vendorId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendor not found"));
        }
        return vendorRepository.findByTenantIdAndVendorId(TenantContext.get(), vendorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendor not found"));
    }

    public Vendor create(Vendor vendor) {
        Vendor saved = vendorRepository.saveAndFlush(vendor);
        entityManager.clear();
        Integer savedVendorId = saved.getVendorId();
        if (savedVendorId == null) {
            return saved;
        }
        return vendorRepository.findById(savedVendorId).orElse(saved);
    }

    public Vendor update(Integer vendorId, Vendor updates) {
        Long targetTenant = isCurrentUserAdmin()
                ? resolveVendorTenant(vendorId)
                : TenantContext.get();
        if (targetTenant == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendor not found");
        }
        Long previousTenant = TenantContext.get();
        try {
            TenantContext.set(targetTenant);
            return updateInTenant(vendorId, updates);
        } finally {
            if (previousTenant == null) {
                TenantContext.clear();
            } else {
                TenantContext.set(previousTenant);
            }
        }
    }

    private Vendor updateInTenant(Integer vendorId, Vendor updates) {
        Vendor existing = vendorRepository.findByTenantIdAndVendorId(TenantContext.get(), vendorId)
                .orElseGet(() -> repairMissingVendor(vendorId, updates));

        existing.setName(updates.getName() == null ? existing.getName() : updates.getName().trim());
        existing.setVendorJDENumber(updates.getVendorJDENumber() == null || updates.getVendorJDENumber().isBlank()
                ? null
                : updates.getVendorJDENumber().trim());
        existing.setCanonicalName(updates.getCanonicalName() == null || updates.getCanonicalName().isBlank()
                ? null
                : updates.getCanonicalName().trim());
        existing.setContactEmail(updates.getContactEmail() == null || updates.getContactEmail().isBlank()
                ? null
                : updates.getContactEmail().trim());
        existing.setAddress(updates.getAddress() == null || updates.getAddress().isBlank()
                ? null
                : updates.getAddress().trim());
        existing.setWebsite(updates.getWebsite() == null || updates.getWebsite().isBlank()
                ? null
                : updates.getWebsite().trim());
        existing.setComments(updates.getComments() == null || updates.getComments().isBlank()
                ? null
                : updates.getComments().trim());

        Vendor saved = vendorRepository.saveAndFlush(existing);
        entityManager.clear();
        Integer savedVendorId = saved.getVendorId();
        if (savedVendorId == null) {
            return saved;
        }
        return vendorRepository.findById(savedVendorId).orElse(saved);
    }

    private Long resolveVendorTenant(Integer vendorId) {
        List<?> rows = entityManager.createNativeQuery(
                "SELECT tenant_id FROM vendors WHERE vendor_id = :vendorId")
                .setParameter("vendorId", vendorId)
                .getResultList();
        return rows.isEmpty() ? null : ((Number) rows.get(0)).longValue();
    }

    private boolean isCurrentUserAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    private Vendor repairMissingVendor(Integer vendorId, Vendor updates) {
        if (vendorRepository.findById(vendorId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendor not found in current tenant");
        }
        Long tenantId = TenantContext.get();
        if (tenantId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tenant is missing");
        }
        String name = updates.getName() == null ? "Unnamed vendor" : updates.getName().trim();
        if (name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vendor name is required");
        }
        entityManager.createNativeQuery("""
                INSERT INTO vendors (vendor_id, tenant_id, name, vendor_jde_number, canonical_name,
                    contact_email, address, website, comments)
                VALUES (:vendorId, :tenantId, :name, :vendorJdeNumber, :canonicalName,
                    :contactEmail, :address, :website, :comments)
                """)
                .setParameter("vendorId", vendorId)
                .setParameter("tenantId", tenantId)
                .setParameter("name", name)
                .setParameter("vendorJdeNumber", updates.getVendorJDENumber())
                .setParameter("canonicalName", updates.getCanonicalName())
                .setParameter("contactEmail", updates.getContactEmail())
                .setParameter("address", updates.getAddress())
                .setParameter("website", updates.getWebsite())
                .setParameter("comments", updates.getComments())
                .executeUpdate();
        entityManager.clear();
        return vendorRepository.findByTenantIdAndVendorId(tenantId, vendorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendor could not be restored"));
    }

    public void delete(Integer vendorId) {
        Long targetTenant = isCurrentUserAdmin() ? resolveVendorTenant(vendorId) : TenantContext.get();
        if (targetTenant == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendor not found");
        }
        Vendor existing = vendorRepository.findByTenantIdAndVendorId(targetTenant, vendorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendor not found"));
        Number contractCount = (Number) entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM contracts WHERE tenant_id = :tenantId AND vendor_id = :vendorId")
                .setParameter("tenantId", targetTenant)
                .setParameter("vendorId", vendorId)
                .getSingleResult();
        if (contractCount.longValue() > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Vendor cannot be deleted while it has contracts");
        }
        try {
            vendorRepository.delete(existing);
            vendorRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Vendor cannot be deleted while it has contracts or licenses", exception);
        }
    }

    public Map<Integer, Long> findSoftwareCounts() {
        return vendorRepository.countSoftwareByVendor(TenantContext.get()).stream()
                .collect(Collectors.toMap(row -> (Integer) row[0], row -> (Long) row[1]));
    }

    public List<VendorDuplicatePair> findPossibleDuplicates() {
        return List.of();
    }
}
