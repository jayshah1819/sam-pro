package com.samtracker.contract;

import com.samtracker.entitlement.LicenseType;
import com.samtracker.entitlement.LicenseStatus;
import com.samtracker.entitlement.PaymentMethod;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record UpdateContractLicenseRequest(
        @NotBlank String licenseName,
        String itOwner,
        String comments,
        @NotBlank String softwareName,
        String version,
        @NotNull LicenseType licenseType,
        LicenseStatus status,
        PaymentMethod paymentMethod,
        Integer seatsPurchased,
        BigDecimal price,
        Integer contractId,
        LocalDate startDate,
        LocalDate expiryDate,
        Boolean renew) {
}