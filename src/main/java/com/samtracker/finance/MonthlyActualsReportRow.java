package com.samtracker.finance;

import java.math.BigDecimal;
import java.util.Map;

// One row of the all-months report: a software's recorded actual per month (1-12), missing months omitted.
public record MonthlyActualsReportRow(String softwareCode, String softwareName,
        Map<Integer, BigDecimal> monthlyActuals) {
}
