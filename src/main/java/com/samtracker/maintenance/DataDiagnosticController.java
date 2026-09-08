package com.samtracker.maintenance;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Temporary one-off diagnostic endpoint, guarded by a shared secret header. Remove after use.
@RestController
public class DataDiagnosticController {

    private final JdbcTemplate jdbcTemplate;
    private final String purgeToken;

    public DataDiagnosticController(JdbcTemplate jdbcTemplate, @Value("${app.purge.token:}") String purgeToken) {
        this.jdbcTemplate = jdbcTemplate;
        this.purgeToken = purgeToken;
    }

    @GetMapping("/internal/diagnose-data")
    public ResponseEntity<?> diagnose(@RequestHeader(value = "X-Purge-Token", required = false) String token) {
        if (purgeToken.isBlank() || token == null || !token.equals(purgeToken)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Integer contracts = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM contracts", Integer.class);
        Integer entitlements = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM entitlements", Integer.class);
        Integer vendors = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM vendors", Integer.class);
        Integer nullContractId = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM entitlements WHERE contract_id IS NULL", Integer.class);
        Integer nullSoftwareId = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM entitlements WHERE software_id IS NULL", Integer.class);
        Integer orphanedContractId = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM entitlements e LEFT JOIN contracts c ON e.contract_id = c.contract_id WHERE e.contract_id IS NOT NULL AND c.contract_id IS NULL",
                Integer.class);
        Integer minContractId = jdbcTemplate.queryForObject("SELECT MIN(contract_id) FROM contracts", Integer.class);
        Integer maxContractId = jdbcTemplate.queryForObject("SELECT MAX(contract_id) FROM contracts", Integer.class);
        List<Map<String, Object>> sample240 = jdbcTemplate.queryForList(
                "SELECT contract_id, tenant_id, contract_number, software_name FROM contracts WHERE contract_id = 240");
        List<Map<String, Object>> tenantCounts = jdbcTemplate.queryForList(
                "SELECT tenant_id, COUNT(*) AS cnt FROM contracts GROUP BY tenant_id");
        List<Map<String, Object>> licenseTenantCounts = jdbcTemplate.queryForList(
                "SELECT tenant_id, COUNT(*) AS cnt FROM entitlements GROUP BY tenant_id");
        List<Map<String, Object>> vendorTenantCounts = jdbcTemplate.queryForList(
                "SELECT tenant_id, COUNT(*) AS cnt FROM vendors GROUP BY tenant_id");
        List<Map<String, Object>> credentials = jdbcTemplate.queryForList(
                "SELECT username, tenant_id, role FROM credentials");
        List<Map<String, Object>> vendor422 = jdbcTemplate.queryForList(
                "SELECT vendor_id, tenant_id, name FROM vendors WHERE vendor_id = 422");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("contracts", contracts);
        result.put("entitlements", entitlements);
        result.put("vendors", vendors);
        result.put("nullContractId", nullContractId);
        result.put("nullSoftwareId", nullSoftwareId);
        result.put("orphanedContractId", orphanedContractId);
        result.put("minContractId", minContractId);
        result.put("maxContractId", maxContractId);
        result.put("contract240", sample240);
        result.put("contractTenantCounts", tenantCounts);
        result.put("licenseTenantCounts", licenseTenantCounts);
        result.put("vendorTenantCounts", vendorTenantCounts);
        result.put("credentials", credentials);
        result.put("vendor422", vendor422);
        return ResponseEntity.ok(result);
    }
}
