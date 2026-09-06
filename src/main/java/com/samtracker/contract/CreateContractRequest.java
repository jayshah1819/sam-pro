package com.samtracker.contract;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.Valid;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record CreateContractRequest(
                @NotBlank String contractNumber,
                @NotNull Integer vendorId,
                String department,
                String itOwner,
                String comments,
                String softwareName,
                @NotNull LocalDate startDate,
                @NotNull LocalDate endDate,
                ContractStatus status,
                BigDecimal value,
                List<@Valid CreateContractLicenseRequest> licenses) {
}