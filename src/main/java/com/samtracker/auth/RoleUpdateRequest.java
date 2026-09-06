package com.samtracker.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record RoleUpdateRequest(
        @NotBlank @Pattern(regexp = "VIEWER|EDITOR|ADMIN", message = "Role must be VIEWER, EDITOR or ADMIN") String role) {
}
