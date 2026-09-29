package com.samtracker.inventory;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

public record InventoryItemRequest(
        String companyGroup,
        String companyNameDivision,
        String systemFunctionality,
        String manufacturerName,
        String vendorName,
        String softwareName,
        BigDecimal totalSoftwareSpend,
        String currency,
        @NotBlank String softwareCode,
        String comments) {
}
