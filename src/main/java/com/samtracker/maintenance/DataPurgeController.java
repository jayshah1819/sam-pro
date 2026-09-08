package com.samtracker.maintenance;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

// Temporary one-off maintenance endpoint, guarded by a shared secret header (not JWT)
// since it must be callable without a logged-in session. Remove after use.
@RestController
public class DataPurgeController {

    private static final Logger log = LoggerFactory.getLogger(DataPurgeController.class);

    private final JdbcTemplate jdbcTemplate;
    private final String purgeToken;

    public DataPurgeController(JdbcTemplate jdbcTemplate, @Value("${app.purge.token:}") String purgeToken) {
        this.jdbcTemplate = jdbcTemplate;
        this.purgeToken = purgeToken;
    }

    @PostMapping("/internal/purge-transactional-data")
    @Transactional
    public ResponseEntity<?> purge(@RequestHeader(value = "X-Purge-Token", required = false) String token) {
        if (purgeToken.isBlank() || token == null || !token.equals(purgeToken)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        int entitlements = jdbcTemplate.update("DELETE FROM entitlements");
        int contracts = jdbcTemplate.update("DELETE FROM contracts");
        int vendors = jdbcTemplate.update("DELETE FROM vendors");
        log.warn("Purged transactional data: entitlements={}, contracts={}, vendors={}", entitlements, contracts,
                vendors);
        return ResponseEntity.ok(Map.of("entitlements", entitlements, "contracts", contracts, "vendors", vendors));
    }
}
