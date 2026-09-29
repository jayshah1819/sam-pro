package com.samtracker.finance;

import java.math.BigDecimal;

public record AddMonthlyActualRequest(Integer year, Integer month, BigDecimal amount) {
}
