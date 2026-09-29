package com.samtracker.finance;

import java.math.BigDecimal;

public interface SoftwareCodeMonthAmount {
    String getSoftwareCode();

    Integer getMonth();

    BigDecimal getAmount();
}
