package com.samtracker.common;

import com.samtracker.contract.ContractService;
import com.samtracker.vendor.VendorService;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AppDataController {

    private final VendorService vendorService;
    private final ContractService contractService;

    public AppDataController(VendorService vendorService, ContractService contractService) {
        this.vendorService = vendorService;
        this.contractService = contractService;
    }

    @GetMapping("/app-data")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','VIEWER')")
    public AppDataResponse getAppData() {
        PageRequest page = PageRequest.of(0, 500);
        return new AppDataResponse(
                vendorService.findAll(page).getContent(),
                contractService.findAllForCurrentUser(page).getContent(),
                contractService.findAllLicensesForCurrentUser());
    }
}
