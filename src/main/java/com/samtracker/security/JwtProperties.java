package com.samtracker.security;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

@ConfigurationProperties(prefix = "app.jwt")
@Validated
@Getter
@Setter
public class JwtProperties {

    @NotBlank
    private String secret;

    @Min(60000)
    private long expirationMs;
}
