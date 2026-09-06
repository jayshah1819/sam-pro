package com.samtracker.contract;

import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/contracts")
public class ContractController {

    private final ContractService contractService;

    public ContractController(ContractService contractService) {
        this.contractService = contractService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','USER')")
    public Page<Contract> getAll(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer vendorId,
            @RequestParam(required = false) ContractStatus status,
            @RequestParam(required = false) LocalDate startDate,
            @RequestParam(required = false) LocalDate endDate,
            @RequestParam(required = false) BigDecimal minValue,
            @RequestParam(required = false) BigDecimal maxValue,
            @PageableDefault(size = 20) Pageable pageable) {
        boolean hasFilters = (q != null && !q.isBlank())
                || vendorId != null
                || status != null
                || startDate != null
                || endDate != null
                || minValue != null
                || maxValue != null;

        if (!hasFilters) {
            return contractService.findAllForCurrentUser(pageable);
        }

        return contractService.findFilteredForCurrentUser(pageable, q, vendorId, status, startDate, endDate, minValue,
                maxValue);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','USER')")
    public Contract getById(@PathVariable Integer id) {
        return contractService.findByIdForCurrentUser(id);
    }

    @GetMapping("/{id}/licenses")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','USER')")
    public List<ContractLicenseView> getLicenses(@PathVariable Integer id) {
        return contractService.findLicenses(id);
    }

    @GetMapping("/licenses/all")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','USER')")
    public List<ContractLicenseView> getAllLicenses() {
        return contractService.findAllLicensesForCurrentUser();
    }

    @PostMapping("/{id}/licenses")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','USER')")
    public ContractLicenseView addLicense(@PathVariable Integer id,
            @Valid @RequestBody CreateContractLicenseRequest request) {
        return contractService.addLicense(id, request);
    }

    @PutMapping("/{id}/licenses/{licenseId}")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','USER')")
    public ContractLicenseView updateLicense(@PathVariable Integer id, @PathVariable Integer licenseId,
            @Valid @RequestBody UpdateContractLicenseRequest request) {
        return contractService.updateLicense(id, licenseId, request);
    }

    @DeleteMapping("/{id}/licenses/{licenseId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','USER')")
    public void deleteLicense(@PathVariable Integer id, @PathVariable Integer licenseId) {
        contractService.deleteLicense(id, licenseId);
    }

    @GetMapping("/ytd")
    @PreAuthorize("hasRole('ADMIN')")
    public Page<Contract> getYtd(
            @RequestParam(required = false) Integer vendorId,
            @PageableDefault(size = 20) Pageable pageable) {
        return contractService.findYtd(pageable, vendorId);
    }

    @GetMapping("/count")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Long> count() {
        return Map.of("total", contractService.countAll());
    }

    @GetMapping("/query")
    @PreAuthorize("hasRole('ADMIN')")
    public Page<Contract> filter(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer vendorId,
            @RequestParam(required = false) ContractStatus status,
            @RequestParam(required = false) LocalDate startDate,
            @RequestParam(required = false) LocalDate endDate,
            @RequestParam(required = false) BigDecimal minValue,
            @RequestParam(required = false) BigDecimal maxValue,
            @PageableDefault(size = 100) Pageable pageable) {
        return contractService.findFiltered(pageable, q, vendorId, status, startDate, endDate, minValue, maxValue);
    }

    @GetMapping("/query-export")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Contract> export(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer vendorId,
            @RequestParam(required = false) ContractStatus status,
            @RequestParam(required = false) LocalDate startDate,
            @RequestParam(required = false) LocalDate endDate,
            @RequestParam(required = false) BigDecimal minValue,
            @RequestParam(required = false) BigDecimal maxValue) {
        return contractService.exportFiltered(q, vendorId, status, startDate, endDate, minValue, maxValue);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','USER')")
    public Contract create(@Valid @RequestBody CreateContractRequest request) {
        return contractService.create(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public Contract update(@PathVariable Integer id, @Valid @RequestBody UpdateContractRequest request) {
        return contractService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public void delete(@PathVariable Integer id) {
        contractService.delete(id);
    }

}
