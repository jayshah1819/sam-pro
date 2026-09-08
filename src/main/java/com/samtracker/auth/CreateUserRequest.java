package com.samtracker.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateUserRequest(
        @NotBlank String username,
        @NotBlank @Size(min = 8, message = "Password must be at least 8 characters") String password,
        @NotBlank @Pattern(regexp = "VIEWER|EDITOR|ADMIN", message = "Role must be VIEWER, EDITOR or ADMIN") String role) {
}
