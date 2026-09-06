package com.samtracker.contract;

import com.samtracker.entitlement.LicenseType;
import com.samtracker.entitlement.LicenseStatus;
import com.samtracker.entitlement.PaymentMethod;

import java.time.LocalDate;
import java.math.BigDecimal;

public record ContractLicenseView(
                Integer licenseId,
                Integer contractId,
                String licenseName,
                String itOwner,
                String comments,
                Integer softwareId,
                String vendorName,
                String softwareName,
                String version,
                LicenseType licenseType,
                LicenseStatus status,
                PaymentMethod paymentMethod,
                Integer seatsPurchased,
                BigDecimal price,
                LocalDate startDate,
                LocalDate expiryDate) {
}
