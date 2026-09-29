package com.samtracker.inventory;

import com.samtracker.tenant.TenantContext;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;

@Service
public class InventoryService {

    private final InventoryItemRepository repository;

    public InventoryService(InventoryItemRepository repository) {
        this.repository = repository;
    }

    public List<InventoryRow> findAllForCurrentUser() {
        List<InventoryItem> items = isCurrentUserAdmin()
                ? repository.findAll()
                : repository.findByTenantIdOrderBySoftwareCodeAsc(TenantContext.get());
        return items.stream()
                .sorted(Comparator.comparing(InventoryItem::getSoftwareCode))
                .map(InventoryRow::from)
                .toList();
    }

    public InventoryRow create(InventoryItemRequest request) {
        String softwareCode = request.softwareCode() == null ? "" : request.softwareCode().strip();
        if (softwareCode.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "softwareCode is required");
        }
        if (repository.existsByTenantIdAndSoftwareCode(TenantContext.get(), softwareCode)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "An inventory row already exists for this software code");
        }
        InventoryItem item = new InventoryItem();
        applyRequest(item, request, softwareCode);
        return InventoryRow.from(repository.saveAndFlush(item));
    }

    public InventoryRow update(Long id, InventoryItemRequest request) {
        InventoryItem item = findOwned(id);
        String softwareCode = request.softwareCode() == null ? "" : request.softwareCode().strip();
        if (softwareCode.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "softwareCode is required");
        }
        applyRequest(item, request, softwareCode);
        return InventoryRow.from(repository.saveAndFlush(item));
    }

    public void delete(Long id) {
        repository.delete(findOwned(id));
    }

    // Keeps the Inventory row's Total Software Spend in sync whenever the finance
    // monthly-spend rollover runs for this software code; a no-op if no
    // inventory row exists yet for it.
    public void syncTotalSoftwareSpend(Long tenantId, String softwareCode, BigDecimal amount) {
        repository.findByTenantIdAndSoftwareCode(tenantId, softwareCode)
                .ifPresent(item -> {
                    item.setTotalSoftwareSpend(amount);
                    repository.saveAndFlush(item);
                });
    }

    // Adding software on the Finance tab should also make it show up in
    // Inventory; creates a starter row if one doesn't already exist for this
    // software code, leaving Inventory-only fields blank for the user to fill in.
    public void ensureInventoryRow(Long tenantId, String softwareCode, String softwareName,
            BigDecimal totalSoftwareSpend) {
        if (repository.existsByTenantIdAndSoftwareCode(tenantId, softwareCode)) {
            return;
        }
        InventoryItem item = new InventoryItem();
        item.setSoftwareCode(softwareCode);
        item.setSoftwareName(softwareName);
        item.setTotalSoftwareSpend(totalSoftwareSpend);
        repository.saveAndFlush(item);
    }

    private InventoryItem findOwned(Long id) {
        InventoryItem item = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inventory row not found"));
        if (!isCurrentUserAdmin() && !item.getTenantId().equals(TenantContext.get())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Inventory row not found");
        }
        return item;
    }

    private void applyRequest(InventoryItem item, InventoryItemRequest request, String softwareCode) {
        item.setCompanyGroup(request.companyGroup());
        item.setCompanyNameDivision(request.companyNameDivision());
        item.setSystemFunctionality(request.systemFunctionality());
        item.setManufacturerName(request.manufacturerName());
        item.setVendorName(request.vendorName());
        item.setSoftwareName(request.softwareName());
        item.setTotalSoftwareSpend(request.totalSoftwareSpend());
        item.setCurrency(request.currency());
        item.setSoftwareCode(softwareCode);
        item.setComments(request.comments());
    }

    private boolean isCurrentUserAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}
