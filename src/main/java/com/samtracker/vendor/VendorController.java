package com.samtracker.vendor;

import com.samtracker.contract.Contract;
import com.samtracker.contract.ContractService;
import com.samtracker.software.SoftwareProduct;
import com.samtracker.software.SoftwareProductService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/vendors")
public class VendorController {
    private final VendorService vendorService;
    private final SoftwareProductService softwareProductService;
    private final ContractService contractService;

    public VendorController(VendorService vendorService, SoftwareProductService softwareProductService,
            ContractService contractService) {
        this.vendorService = vendorService;
        this.softwareProductService = softwareProductService;
        this.contractService = contractService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','USER')")
    public Page<Vendor> getAll(@RequestParam(required = false) String q,
            @PageableDefault(size = 20) Pageable pageable) {
        return q != null && !q.isBlank() ? vendorService.findByNameContains(q, pageable)
                : vendorService.findAll(pageable);
    }

    @GetMapping("/software-counts")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<Integer, Long> getSoftwareCounts() {
        return vendorService.findSoftwareCounts();
    }

    @GetMapping("/{vendorId}")
    @PreAuthorize("hasRole('ADMIN')")
    public Vendor getById(@PathVariable Integer vendorId) {
        return vendorService.findById(vendorId);
    }

    @GetMapping("/duplicates")
    @PreAuthorize("hasRole('ADMIN')")
    public List<VendorDuplicatePair> getDuplicates() {
        return vendorService.findPossibleDuplicates();
    }

    @GetMapping("/{vendorId}/contracts")
    @PreAuthorize("hasRole('ADMIN')")
    public Page<Contract> getContracts(@PathVariable Integer vendorId, @PageableDefault(size = 20) Pageable pageable) {
        return contractService.findByVendorId(vendorId, pageable);
    }

    @GetMapping("/{vendorId}/software")
    @PreAuthorize("hasRole('ADMIN')")
    public Page<SoftwareProduct> getSoftware(@PathVariable Integer vendorId,
            @PageableDefault(size = 50) Pageable pageable) {
        return softwareProductService.findByVendorName(vendorService.findById(vendorId).getName(), pageable);
    }

    @GetMapping("/{vendorId}/licenses")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','USER')")
    public List<com.samtracker.contract.ContractLicenseView> getLicenses(@PathVariable Integer vendorId) {
        return contractService.findVendorLicenses(vendorId);
    }

    @PostMapping("/{vendorId}/licenses")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','USER')")
    public com.samtracker.contract.ContractLicenseView addLicense(@PathVariable Integer vendorId,
            @Valid @RequestBody com.samtracker.contract.CreateContractLicenseRequest request) {
        return contractService.addVendorLicense(vendorId, request);
    }

    @PutMapping("/{vendorId}/licenses/{licenseId}")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','USER')")
    public com.samtracker.contract.ContractLicenseView updateLicense(@PathVariable Integer vendorId,
            @PathVariable Integer licenseId,
            @Valid @RequestBody com.samtracker.contract.UpdateContractLicenseRequest request) {
        return contractService.updateVendorLicense(vendorId, licenseId, request);
    }

    @DeleteMapping("/{vendorId}/licenses/{licenseId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','USER')")
    public void deleteLicense(@PathVariable Integer vendorId, @PathVariable Integer licenseId) {
        contractService.deleteVendorLicense(vendorId, licenseId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','USER')")
    public Vendor create(@RequestBody Vendor vendor) {
        return vendorService.create(vendor);
    }
}
