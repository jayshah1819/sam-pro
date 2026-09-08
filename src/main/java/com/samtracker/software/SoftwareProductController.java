package com.samtracker.software;

import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/software")
public class SoftwareProductController {

    private final SoftwareProductService softwareProductService;

    public SoftwareProductController(SoftwareProductService softwareProductService) {
        this.softwareProductService = softwareProductService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','VIEWER')")
    public Page<SoftwareProduct> getAll(
            @RequestParam(required = false) String vendor,
            @PageableDefault(size = 20) Pageable pageable) {
        if (vendor != null && !vendor.isBlank()) {
            return softwareProductService.findByVendorName(vendor, pageable);
        }
        return softwareProductService.findAll(pageable);
    }

    @GetMapping("/vendors")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','VIEWER')")
    public List<VendorSoftwareSummary> getVendorSummary() {
        return softwareProductService.findVendorSummary();
    }

    @GetMapping("/vendor-count")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Long> getVendorCountBySoftwareName(@RequestParam String name) {
        return Map.of("vendors", softwareProductService.countVendorsBySoftwareName(name));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public SoftwareProduct create(@Valid @RequestBody CreateSoftwareProductRequest request) {
        return softwareProductService.create(request);
    }

}
