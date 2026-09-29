package com.samtracker.finance;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

// Finance rows created before Finance->Inventory sync existed have no matching
// Inventory row. This runs as plain SQL (not Hibernate entities) because
// InventoryItem.tenantId is @TenantId-controlled: Hibernate binds it to whatever
// tenant the persistence session first resolved, ignoring any tenantId we pass in,
// so a loop that flips TenantContext per-row silently writes every row under the
// same (wrong) tenant. Raw SQL sidesteps that entirely and is idempotent/safe to
// run on every boot. Runs AFTER LicenseFinanceBackfillRunner (@Order(1)) so
// Finance rows backfilled from Licenses in this same boot also reach Inventory.
@Component
@Order(2)
public class FinanceInventoryBackfillRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    public FinanceInventoryBackfillRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        jdbcTemplate.update(
                """
                        INSERT INTO inventory_item (tenant_id, software_code, software_name, total_software_spend)
                        SELECT fv.tenant_id, fv.software_code, fv.software_name, fv.software_spend
                        FROM finance_view fv
                        WHERE NOT EXISTS (
                            SELECT 1 FROM inventory_item ii
                            WHERE ii.tenant_id = fv.tenant_id AND ii.software_code = fv.software_code
                        )
                        """);
    }
}
