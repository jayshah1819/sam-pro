package com.samtracker.finance;

import java.math.BigDecimal;

// Flat projection used to bulk-load per-software amounts without N+1 queries.
public interface SoftwareCodeAmount {
    String getSoftwareCode();

    BigDecimal getAmount();
}
