package com.samtracker.finance;

import java.math.BigDecimal;

public record CreateFinanceViewRequest(
        String softwareCode,
        String sourceBudget,
        String primaryCategory,
        String subCategory,
        String businessCriticality,
        String strategy,
        String erp,
        String costCode,
        String location,
        Integer vendorId,
        String softwareName,
        BigDecimal baselineBudget,
        BigDecimal softwareSpend,
        BigDecimal actuals,
        BigDecimal remaining,
        BigDecimal managedServiceProviders,
        BigDecimal itStaffInternalLabour,
        BigDecimal itStaffExternalLabour,
        BigDecimal depreciationAmortisation,
        BigDecimal cloudSolutions,
        BigDecimal consultingOutsideServices,
        BigDecimal totalTco,
        BigDecimal costRecoveries) {
}
