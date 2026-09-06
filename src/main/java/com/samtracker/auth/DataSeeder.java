package com.samtracker.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

// Inserts one admin credential on first boot so the app is immediately usable
@Component
public class DataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    private static final Long DEFAULT_TENANT = 1L;

    private final CredentialRepository credentialRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(CredentialRepository credentialRepository, PasswordEncoder passwordEncoder) {
        this.credentialRepository = credentialRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (credentialRepository.count() > 0)
            return;

        Credential admin = new Credential();
        admin.setUsername("admin");
        admin.setPasswordHash(passwordEncoder.encode("admin123"));
        admin.setTenantId(DEFAULT_TENANT);
        admin.setRole("ADMIN");
        credentialRepository.save(admin);
        log.info("Seeded default credential — username: admin  password: admin123");
    }
}
