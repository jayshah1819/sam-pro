package com.samtracker.integration;

import java.math.BigDecimal;
import java.util.List;

public final class IntegrationDtos {

    private IntegrationDtos() {
    }

    public record PageResponse<T>(List<T> items, int limit, int offset, boolean hasMore) {
    }

    public record VendorSummary(Integer id, String name, String jdeNumber, String website, String contactEmail) {
    }

    public record ContractSummary(Integer id, String contractNumber, String softwareName, String status,
            String startDate, String endDate, BigDecimal value) {
    }

    public record LicenseSummary(Integer id, String softwareName, String version, String status, Integer seats,
            BigDecimal price, String expiryDate, String location) {
    }

    public record VendorDetail(Integer id, String name, String jdeNumber, String website, String contactEmail,
            String address, String comments, List<String> aliases, List<ContractSummary> contracts,
            List<LicenseSummary> licenses) {
    }

    public record ErrorResponse(String error, String message) {
    }
}
