package com.samtracker.finance;

import java.math.BigDecimal;

public record FinanceViewRow(
        Long id,
        String softwareCode,
        Long tenantId,
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

    public static FinanceViewRow from(FinanceView row) {
        return new FinanceViewRow(
                row.getId(),
                row.getSoftwareCode(),
                row.getTenantId(),
                row.getSourceBudget(),
                row.getPrimaryCategory(),
                row.getSubCategory(),
                row.getBusinessCriticality(),
                row.getStrategy(),
                row.getErp(),
                row.getCostCode(),
                row.getLocation(),
                row.getVendorId(),
                row.getSoftwareName(),
                row.getBaselineBudget(),
                row.getSoftwareSpend(),
                row.getActuals(),
                row.getRemaining(),
                row.getManagedServiceProviders(),
                row.getItStaffInternalLabour(),
                row.getItStaffExternalLabour(),
                row.getDepreciationAmortisation(),
                row.getCloudSolutions(),
                row.getConsultingOutsideServices(),
                row.getTotalTco(),
                row.getCostRecoveries());
    }

    // Overrides Actuals/Software Spend/Remaining with the values recorded for a
    // specific month, leaving every other column from the row untouched.
    public static FinanceViewRow forMonth(
            FinanceView row, BigDecimal monthActuals, BigDecimal monthSoftwareSpend, BigDecimal remainingAfterMonth) {
        FinanceViewRow base = from(row);
        return new FinanceViewRow(
                base.id(), base.softwareCode(), base.tenantId(), base.sourceBudget(), base.primaryCategory(), base.subCategory(),
                base.businessCriticality(), base.strategy(), base.erp(), base.costCode(), base.location(),
                base.vendorId(), base.softwareName(), base.baselineBudget(), monthSoftwareSpend,
                monthActuals, remainingAfterMonth, base.managedServiceProviders(), base.itStaffInternalLabour(),
                base.itStaffExternalLabour(), base.depreciationAmortisation(), base.cloudSolutions(),
                base.consultingOutsideServices(), base.totalTco(), base.costRecoveries());
    }
}
