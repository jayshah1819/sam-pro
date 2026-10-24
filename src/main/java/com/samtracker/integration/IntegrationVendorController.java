package com.samtracker.integration;

import com.samtracker.contract.Contract;
import com.samtracker.contract.ContractLicenseView;
import com.samtracker.contract.ContractService;
import com.samtracker.integration.IntegrationDtos.ContractSummary;
import com.samtracker.integration.IntegrationDtos.LicenseSummary;
import com.samtracker.integration.IntegrationDtos.PageResponse;
import com.samtracker.integration.IntegrationDtos.VendorDetail;
import com.samtracker.integration.IntegrationDtos.VendorSummary;
import com.samtracker.vendor.Vendor;
import com.samtracker.vendor.VendorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/vendors")
@ConditionalOnProperty(name = "integration.enabled", havingValue = "true")
public class IntegrationVendorController {

    static final int MAX_LIMIT = 50;
    static final int MAX_OFFSET = 5000;

    private final VendorService vendorService;
    private final ContractService contractService;

    public IntegrationVendorController(VendorService vendorService, ContractService contractService) {
        this.vendorService = vendorService;
        this.contractService = contractService;
    }

    @GetMapping
    @Operation(operationId = "listVendors", summary = "List vendors",
            description = "Returns a compact, paged list of vendors. Use search to filter by name, JDE number or contact email.")
    public PageResponse<VendorSummary> listVendors(
            @Parameter(description = "Text to search for") @RequestParam(defaultValue = "") String search,
            @Parameter(description = "Page size, 1-50") @RequestParam(defaultValue = "10") int limit,
            @Parameter(description = "Number of results to skip") @RequestParam(defaultValue = "0") int offset) {
        int size = Math.max(1, Math.min(limit, MAX_LIMIT));
        int skip = Math.max(0, Math.min(offset, MAX_OFFSET));
        List<Vendor> window = vendorService.findByNameContains(search, PageRequest.of(0, skip + size + 1))
                .getContent();
        List<VendorSummary> items = window.stream().skip(skip).limit(size).map(IntegrationVendorController::summary)
                .toList();
        return new PageResponse<>(items, size, skip, window.size() > skip + size);
    }

    @GetMapping("/{id}")
    @Operation(operationId = "getVendor", summary = "Get a vendor",
            description = "Returns one vendor with its contracts and licenses (up to 50 of each).")
    public VendorDetail getVendor(@Parameter(description = "Vendor id") @PathVariable Integer id) {
        Vendor v = vendorService.findById(id);
        List<ContractSummary> contracts = contractService.findByVendorId(id, PageRequest.of(0, MAX_LIMIT))
                .getContent().stream().map(IntegrationVendorController::contract).toList();
        List<LicenseSummary> licenses = contractService.findVendorLicenses(id).stream().limit(MAX_LIMIT)
                .map(IntegrationVendorController::license).toList();
        return new VendorDetail(v.getVendorId(), v.getName(), v.getVendorJDENumber(), v.getWebsite(),
                v.getContactEmail(), v.getAddress(), v.getComments(),
                v.getAliases() == null ? List.of() : List.copyOf(v.getAliases()), contracts, licenses);
    }

    private static VendorSummary summary(Vendor v) {
        return new VendorSummary(v.getVendorId(), v.getName(), v.getVendorJDENumber(), v.getWebsite(),
                v.getContactEmail());
    }

    private static ContractSummary contract(Contract c) {
        return new ContractSummary(c.getId(), c.getContractNumber(), c.getSoftwareName(),
                c.getStatus() == null ? null : c.getStatus().name(),
                c.getStartDate() == null ? null : c.getStartDate().toString(),
                c.getEndDate() == null ? null : c.getEndDate().toString(), c.getValue());
    }

    private static LicenseSummary license(ContractLicenseView l) {
        return new LicenseSummary(l.licenseId(), l.softwareName(), l.version(),
                l.status() == null ? null : l.status().name(), l.seatsPurchased(), l.price(),
                l.expiryDate() == null ? null : l.expiryDate().toString(), l.location());
    }
}
