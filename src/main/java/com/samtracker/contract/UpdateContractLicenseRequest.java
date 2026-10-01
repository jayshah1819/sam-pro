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
        String businessOwner,
        String comments,
        @NotBlank String softwareName,
        String version,
        @NotNull LicenseType licenseType,
        LicenseStatus status,
        PaymentMethod paymentMethod,
        Integer seatsPurchased,
        BigDecimal price,
        Integer contractId,
        String location,
        LocalDate startDate,
        LocalDate expiryDate,
        Boolean renew,
        String softwareCode,
        String functionalGrouping,
        String functionalOwner,
        String confidenceLevel,
        String manufacturerName,
        String systemCategory,
        String systemCategorization,
        String businessCriticality,
        String systemStrategy,
        String erpSystem,
        BigDecimal annualInfrastructureCost,
        BigDecimal annualCostNonLicense,
        BigDecimal annualLicenseCost,
        BigDecimal annualCostTotal,
        BigDecimal acsBudget,
        Integer numberOfActiveUsers,
        Integer numberOfLicensesOwned,
        String proposedFunctionGroupOwner,
        String billingVendor,
        Integer billingVendorId,
        String businessFunction,
        Integer numberOfUsers,
        String budgetOwner,
        String primaryItGroup,
        String primaryItGroupLeadership,
        String contractDuration,
        String paymentSchedule,
        String currency,
        String criticalityLevels,
        String description,
        String boxLink) {
}