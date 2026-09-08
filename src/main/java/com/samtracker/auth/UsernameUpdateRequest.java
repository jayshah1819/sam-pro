package com.samtracker.auth;

import jakarta.validation.constraints.NotBlank;

public record UsernameUpdateRequest(@NotBlank String username) {
}
