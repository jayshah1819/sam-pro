package com.samtracker.connector;

import com.samtracker.contract.Contract;
import com.samtracker.contract.ContractLicenseView;
import com.samtracker.contract.ContractService;
import com.samtracker.contract.ContractStatus;
import com.samtracker.vendor.Vendor;
import com.samtracker.vendor.VendorService;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Small, flat, read-only payloads for Power Apps / Copilot Studio. */
@RestController
@RequestMapping("/connector")
@PreAuthorize("hasAnyRole('ADMIN','EDITOR','VIEWER')")
public class ConnectorController {

    private static final int MAX_LIMIT = 50;

    private final VendorService vendorService;
    private final ContractService contractService;

    public ConnectorController(VendorService vendorService, ContractService contractService) {
        this.vendorService = vendorService;
        this.contractService = contractService;
    }

    public record VendorSummary(Integer id, String name, String jdeNumber, String website, String contactEmail) {
        static VendorSummary of(Vendor v) {
            return new VendorSummary(v.getVendorId(), v.getName(), v.getVendorJDENumber(), v.getWebsite(),
                    v.getContactEmail());
        }
    }

    public record ContractSummary(Integer id, Integer vendorId, String vendorName, String contractNumber,
            String softwareName, String status, LocalDate startDate, LocalDate endDate, BigDecimal value) {
        static ContractSummary of(Contract c) {
            return new ContractSummary(c.getId(), c.getVendorId(), c.getVendorName(), c.getContractNumber(),
                    c.getSoftwareName(), c.getStatus() == null ? null : c.getStatus().name(), c.getStartDate(),
                    c.getEndDate(), c.getValue());
        }
    }

    public record LicenseSummary(Integer id, String softwareName, String version, String status, Integer seats,
            BigDecimal price, LocalDate expiryDate, String location) {
        static LicenseSummary of(ContractLicenseView l) {
            return new LicenseSummary(l.licenseId(), l.softwareName(), l.version(),
                    l.status() == null ? null : l.status().name(), l.seatsPurchased(), l.price(), l.expiryDate(),
                    l.location());
        }
    }

    public record VendorDetail(VendorSummary vendor, List<ContractSummary> contracts, List<LicenseSummary> licenses) {
    }

    @GetMapping("/vendors")
    public List<VendorSummary> vendors(@RequestParam(required = false) String q,
            @RequestParam(defaultValue = "20") int limit) {
        return vendorService.findByNameContains(q, PageRequest.of(0, clamp(limit))).getContent().stream()
                .map(VendorSummary::of).toList();
    }

    @GetMapping("/vendors/{vendorId}")
    public VendorDetail vendor(@PathVariable Integer vendorId, @RequestParam(defaultValue = "20") int limit) {
        int size = clamp(limit);
        List<ContractSummary> contracts = contractService.findByVendorId(vendorId, PageRequest.of(0, size))
                .getContent().stream().map(ContractSummary::of).toList();
        List<LicenseSummary> licenses = contractService.findVendorLicenses(vendorId).stream().limit(size)
                .map(LicenseSummary::of).toList();
        return new VendorDetail(VendorSummary.of(vendorService.findById(vendorId)), contracts, licenses);
    }

    @GetMapping("/contracts")
    public List<ContractSummary> contracts(@RequestParam(required = false) String q,
            @RequestParam(required = false) Integer vendorId,
            @RequestParam(required = false) ContractStatus status,
            @RequestParam(defaultValue = "20") int limit) {
        return contractService.findFiltered(PageRequest.of(0, clamp(limit)), q, vendorId, status, null, null, null,
                null).getContent().stream().map(ContractSummary::of).toList();
    }

    private static int clamp(int limit) {
        return Math.max(1, Math.min(limit, MAX_LIMIT));
    }
}
