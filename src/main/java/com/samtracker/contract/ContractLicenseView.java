package com.samtracker.contract;

import com.samtracker.entitlement.LicenseType;
import com.samtracker.entitlement.LicenseStatus;
import com.samtracker.entitlement.PaymentMethod;

import java.time.LocalDate;
import java.math.BigDecimal;

public record ContractLicenseView(
                Integer licenseId,
                Integer contractId,
                String location,
                String licenseName,
                String itOwner,
                String businessOwner,
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
                LocalDate expiryDate,
                String softwareCode,
                Integer vendorId,
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
