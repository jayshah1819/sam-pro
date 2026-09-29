package com.samtracker.inventory;

import java.math.BigDecimal;

public record InventoryRow(
        Long id,
        String companyGroup,
        String companyNameDivision,
        String systemFunctionality,
        String manufacturerName,
        String vendorName,
        String softwareName,
        BigDecimal totalSoftwareSpend,
        String currency,
        String softwareCode,
        String comments) {

    public static InventoryRow from(InventoryItem item) {
        return new InventoryRow(
                item.getId(),
                item.getCompanyGroup(),
                item.getCompanyNameDivision(),
                item.getSystemFunctionality(),
                item.getManufacturerName(),
                item.getVendorName(),
                item.getSoftwareName(),
                item.getTotalSoftwareSpend(),
                item.getCurrency(),
                item.getSoftwareCode(),
                item.getComments());
    }
}
