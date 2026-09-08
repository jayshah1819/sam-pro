package com.samtracker.vendor;

import com.samtracker.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// Hibernate's DISCRIMINATOR multi-tenancy binds the current tenant identifier once
// per request session, so JPA queries can't be redirected to another tenant mid-request
// even via TenantContext.set(). Admin cross-tenant access therefore goes through
// JdbcTemplate (raw SQL), which bypasses that filter entirely.
@Service
public class VendorService {
    private final VendorRepository vendorRepository;
    private final EntityManager entityManager;
    private final JdbcTemplate jdbcTemplate;

    public VendorService(VendorRepository vendorRepository, EntityManager entityManager, JdbcTemplate jdbcTemplate) {
        this.vendorRepository = vendorRepository;
        this.entityManager = entityManager;
        this.jdbcTemplate = jdbcTemplate;
    }

    public Page<Vendor> findAll(Pageable pageable) {
        Pageable capped = PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 500),
                pageable.getSort());
        if (isCurrentUserAdmin()) {
            return findAllAdmin(capped);
        }
        return vendorRepository.findByTenantId(TenantContext.get(), capped);
    }

    private Page<Vendor> findAllAdmin(Pageable pageable) {
        long total = queryLong("SELECT COUNT(*) FROM vendors");
        List<Vendor> rows = jdbcTemplate.query(
                "SELECT * FROM vendors ORDER BY vendor_id LIMIT ? OFFSET ?",
                this::mapVendorRow, pageable.getPageSize(), pageable.getOffset());
        return new PageImpl<>(rows, pageable, total);
    }

    public Page<Vendor> findByNameContains(String name, Pageable pageable) {
        Pageable capped = PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 500),
                pageable.getSort());
        if (isCurrentUserAdmin()) {
            return findByNameContainsAdmin(name, capped);
        }
        return vendorRepository.searchByTenantId(TenantContext.get(), name == null ? "" : name.trim(), capped);
    }

    private Page<Vendor> findByNameContainsAdmin(String name, Pageable pageable) {
        String needle = "%" + (name == null ? "" : name.trim()) + "%";
        long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM vendors WHERE name LIKE ? OR vendor_jde_number LIKE ? OR contact_email LIKE ?",
                Long.class, needle, needle, needle);
        List<Vendor> rows = jdbcTemplate.query(
                "SELECT * FROM vendors WHERE name LIKE ? OR vendor_jde_number LIKE ? OR contact_email LIKE ? "
                        + "ORDER BY vendor_id LIMIT ? OFFSET ?",
                this::mapVendorRow, needle, needle, needle, pageable.getPageSize(), pageable.getOffset());
        return new PageImpl<>(rows, pageable, total);
    }

    public Vendor findById(Integer vendorId) {
        if (isCurrentUserAdmin()) {
            return findByIdAdmin(vendorId);
        }
        return vendorRepository.findByTenantIdAndVendorId(TenantContext.get(), vendorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendor not found"));
    }

    private Vendor findByIdAdmin(Integer vendorId) {
        List<Vendor> rows = jdbcTemplate.query("SELECT * FROM vendors WHERE vendor_id = ?", this::mapVendorRow,
                vendorId);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendor not found");
        }
        return rows.get(0);
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
        if (isCurrentUserAdmin()) {
            return updateAdmin(vendorId, updates);
        }
        return updateInTenant(vendorId, updates);
    }

    private Vendor updateAdmin(Integer vendorId, Vendor updates) {
        int updated = jdbcTemplate.update("""
                UPDATE vendors
                SET name = ?, vendor_jde_number = ?, canonical_name = ?, contact_email = ?, address = ?, website = ?, comments = ?
                WHERE vendor_id = ?
                """,
                blankToNull(updates.getName()),
                blankToNull(updates.getVendorJDENumber()),
                blankToNull(updates.getCanonicalName()),
                blankToNull(updates.getContactEmail()),
                blankToNull(updates.getAddress()),
                blankToNull(updates.getWebsite()),
                blankToNull(updates.getComments()),
                vendorId);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendor not found");
        }
        return findByIdAdmin(vendorId);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
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
        if (isCurrentUserAdmin()) {
            deleteAdmin(vendorId);
            return;
        }
        Vendor existing = vendorRepository.findByTenantIdAndVendorId(TenantContext.get(), vendorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendor not found"));
        Number contractCount = (Number) entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM contracts WHERE tenant_id = :tenantId AND vendor_id = :vendorId")
                .setParameter("tenantId", TenantContext.get())
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

    private void deleteAdmin(Integer vendorId) {
        long contractCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM contracts WHERE vendor_id = ?", Long.class, vendorId);
        if (contractCount > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Vendor cannot be deleted while it has contracts");
        }
        try {
            int deleted = jdbcTemplate.update("DELETE FROM vendors WHERE vendor_id = ?", vendorId);
            if (deleted == 0) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendor not found");
            }
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

    private long queryLong(String sql) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class);
        return value == null ? 0 : value;
    }

    private Vendor mapVendorRow(ResultSet rs, int rowNum) throws SQLException {
        Vendor vendor = new Vendor();
        vendor.setVendorId((Integer) rs.getObject("vendor_id"));
        vendor.assignTenantId(rs.getLong("tenant_id"));
        vendor.setName(rs.getString("name"));
        vendor.setVendorJDENumber(rs.getString("vendor_jde_number"));
        vendor.setCanonicalName(rs.getString("canonical_name"));
        vendor.setContactEmail(rs.getString("contact_email"));
        vendor.setAddress(rs.getString("address"));
        vendor.setWebsite(rs.getString("website"));
        vendor.setComments(rs.getString("comments"));
        return vendor;
    }
}

