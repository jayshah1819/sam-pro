package com.samtracker.common;

import com.samtracker.contract.Contract;
import com.samtracker.contract.ContractLicenseView;
import com.samtracker.vendor.Vendor;

import java.util.List;

public record AppDataResponse(
        List<Vendor> vendors,
        List<Contract> contracts,
        List<ContractLicenseView> licenses) {
}
