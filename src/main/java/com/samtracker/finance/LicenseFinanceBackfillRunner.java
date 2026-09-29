package com.samtracker.finance;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

// Licenses created/edited before the software_id-derived software_code fix (or
// never re-saved since) have no matching Finance row. This runs as plain SQL
// (not Hibernate entities) for the same @TenantId reason as
// FinanceInventoryBackfillRunner, and is idempotent/safe to run on every boot.
// Must run BEFORE FinanceInventoryBackfillRunner so newly backfilled Finance
// rows also flow through to Inventory in the same boot — see @Order below.
@Component
@Order(1)
public class LicenseFinanceBackfillRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    public LicenseFinanceBackfillRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        jdbcTemplate.update(
                """
                        UPDATE entitlements
                        SET software_code = CAST(software_id AS CHAR)
                        WHERE software_code IS NULL AND software_id IS NOT NULL
                        """);

        jdbcTemplate.update(
                """
                        INSERT INTO finance_view (software_code, tenant_id, software_name, vendor_id, software_spend)
                        SELECT e.software_code, e.tenant_id, MAX(sp.name), MAX(e.vendor_id), MAX(e.annual_license_cost)
                        FROM entitlements e
                        JOIN software_products sp ON sp.software_id = e.software_id AND sp.tenant_id = e.tenant_id
                        WHERE e.software_code IS NOT NULL
                          AND NOT EXISTS (
                              SELECT 1 FROM finance_view fv
                              WHERE fv.tenant_id = e.tenant_id AND fv.software_code = e.software_code
                                AND fv.cost_code IS NULL
                          )
                        GROUP BY e.software_code, e.tenant_id
                        """);
    }
}
