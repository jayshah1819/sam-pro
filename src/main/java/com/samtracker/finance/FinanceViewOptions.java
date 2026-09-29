package com.samtracker.finance;

import java.util.List;

public record FinanceViewOptions(List<String> businessCriticality, List<String> strategy) {
}
