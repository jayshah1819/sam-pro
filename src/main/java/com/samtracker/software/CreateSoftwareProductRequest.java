package com.samtracker.software;

import jakarta.validation.constraints.NotBlank;

public record CreateSoftwareProductRequest(
        @NotBlank String name,
        @NotBlank String vendor,
        @NotBlank String version) {
}