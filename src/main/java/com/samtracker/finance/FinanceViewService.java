package com.samtracker.finance;

import com.samtracker.contract.ContractService;
import com.samtracker.inventory.InventoryService;
import com.samtracker.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class FinanceViewService {

    // Fixed dropdown values, independent of the Primary/Sub-Category taxonomy.
    public static final List<String> BUSINESS_CRITICALITY_OPTIONS = List.of(
            "Critical Business System", "Important Business System", "Non-Critical Business System");
    public static final List<String> STRATEGY_OPTIONS = List.of(
            "Tolerate", "Decommission", "Sustain", "Innovate", "Invest", "Replace");

    private static final Set<String> VALID_CRITICALITY = Set.copyOf(BUSINESS_CRITICALITY_OPTIONS);
    private static final Set<String> VALID_STRATEGY = Set.copyOf(STRATEGY_OPTIONS);

    private final FinanceViewRepository repository;
    private final FinanceMonthlyActualRepository monthlyActualRepository;
    private final FinanceMonthlySoftwareSpendRepository softwareSpendRepository;
    private final InventoryService inventoryService;
    private final ContractService contractService;
    private final EntityManager entityManager;
    private final JdbcTemplate jdbcTemplate;

    public FinanceViewService(
            FinanceViewRepository repository, FinanceMonthlyActualRepository monthlyActualRepository,
            FinanceMonthlySoftwareSpendRepository softwareSpendRepository, InventoryService inventoryService,
            ContractService contractService, EntityManager entityManager, JdbcTemplate jdbcTemplate) {
        this.repository = repository;
        this.monthlyActualRepository = monthlyActualRepository;
        this.softwareSpendRepository = softwareSpendRepository;
        this.inventoryService = inventoryService;
        this.contractService = contractService;
        this.entityManager = entityManager;
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<FinanceViewRow> findAllForCurrentUser(Integer year, Integer month) {
        List<FinanceView> rows = isCurrentUserAdmin()
                ? repository.findAll()
                : repository.findByTenantIdOrderBySoftwareCodeAsc(TenantContext.get());

        int y = year != null ? year : LocalDate.now().getYear();
        int m = month != null ? month : LocalDate.now().getMonthValue();
        int prevYear = m == 1 ? y - 1 : y;
        int prevMonth = m == 1 ? 12 : m - 1;
        Long tenantId = TenantContext.get();

        Map<String, BigDecimal> monthAmounts = new HashMap<>();
        for (SoftwareCodeAmount entry : monthlyActualRepository.findAmountsForMonth(tenantId, y, m)) {
            monthAmounts.put(entry.getSoftwareCode(), entry.getAmount());
        }

        return rows.stream()
                .map(row -> {
                    String code = row.getSoftwareCode();
                    BigDecimal monthActuals = monthAmounts.get(code);
                    BigDecimal spend = resolveMonthlySoftwareSpend(tenantId, code, y, m, prevYear, prevMonth);
                    // Rows with no monthly history at all yet keep showing their originally
                    // imported values.
                    if (monthActuals == null && spend == null) {
                        return FinanceViewRow.from(row);
                    }
                    BigDecimal actuals = monthActuals != null ? monthActuals : BigDecimal.ZERO;
                    BigDecimal effectiveSpend = spend != null ? spend : row.getSoftwareSpend();
                    BigDecimal remaining = row.getBaselineBudget() != null && spend != null
                            ? row.getBaselineBudget().subtract(spend)
                            : row.getRemaining();
                    return FinanceViewRow.forMonth(row, actuals, effectiveSpend, remaining);
                })
                .toList();
    }

    // Looks up this software's Software Spend for the given month, auto-rolling
    // it forward from the prior month's recorded Actuals the first time this
    // month is viewed (persisting it once, and syncing the Inventory tab's Total
    // Software Spend for that software code). Returns null if neither exists.
    private BigDecimal resolveMonthlySoftwareSpend(
            Long tenantId, String softwareCode, int year, int month, int prevYear, int prevMonth) {
        return softwareSpendRepository
                .findByTenantIdAndSoftwareCodeAndYearAndMonth(tenantId, softwareCode, year, month)
                .map(FinanceMonthlySoftwareSpend::getAmount)
                .orElseGet(() -> monthlyActualRepository
                        .findByTenantIdAndSoftwareCodeAndYearAndMonth(tenantId, softwareCode, prevYear, prevMonth)
                        .map(FinanceMonthlyActual::getAmount)
                        .map(amount -> {
                            FinanceMonthlySoftwareSpend spend = new FinanceMonthlySoftwareSpend();
                            spend.setSoftwareCode(softwareCode);
                            spend.setYear(year);
                            spend.setMonth(month);
                            spend.setAmount(amount);
                            softwareSpendRepository.saveAndFlush(spend);
                            inventoryService.syncTotalSoftwareSpend(tenantId, softwareCode, amount);
                            return amount;
                        })
                        .orElse(null));
    }

    // One row per software with its recorded actual for every month of the given
    // year, for the "all months" report tab.
    public List<MonthlyActualsReportRow> getMonthlyActualsReport(Integer year) {
        int y = year != null ? year : LocalDate.now().getYear();
        List<FinanceView> rows = isCurrentUserAdmin()
                ? repository.findAll()
                : repository.findByTenantIdOrderBySoftwareCodeAsc(TenantContext.get());
        Long tenantId = TenantContext.get();

        Map<String, Map<Integer, BigDecimal>> bySoftware = new HashMap<>();
        for (SoftwareCodeMonthAmount entry : monthlyActualRepository.findAmountsForYear(tenantId, y)) {
            bySoftware.computeIfAbsent(entry.getSoftwareCode(), key -> new HashMap<>())
                    .put(entry.getMonth(), entry.getAmount());
        }

        return rows.stream()
                .sorted(Comparator.comparing(FinanceView::getSoftwareCode))
                .map(row -> new MonthlyActualsReportRow(
                        row.getSoftwareCode(),
                        row.getSoftwareName(),
                        bySoftware.getOrDefault(row.getSoftwareCode(), Map.of())))
                .toList();
    }

    // The amount already recorded for this software/month, so the "+ Actual" form
    // can prefill it for editing.
    public BigDecimal getMonthlyActual(String softwareCode, int year, int month) {
        return monthlyActualRepository
                .findByTenantIdAndSoftwareCodeAndYearAndMonth(TenantContext.get(), softwareCode, year, month)
                .map(FinanceMonthlyActual::getAmount)
                .orElse(null);
    }

    public FinanceViewRow create(CreateFinanceViewRequest request) {
        String softwareCode = request.softwareCode() == null ? "" : request.softwareCode().strip();
        if (softwareCode.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "softwareCode is required");
        }
        String costCode = request.costCode() == null || request.costCode().isBlank() ? null : request.costCode();
        if (repository.existsByTenantIdAndSoftwareCodeAndCostCode(TenantContext.get(), softwareCode, costCode)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A finance row already exists for this software code and cost code");
        }
        if (request.businessCriticality() != null && !request.businessCriticality().isBlank()
                && !VALID_CRITICALITY.contains(request.businessCriticality())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid businessCriticality value");
        }
        if (request.strategy() != null && !request.strategy().isBlank()
                && !VALID_STRATEGY.contains(request.strategy())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid strategy value");
        }
        FinanceView row = new FinanceView();
        row.setSoftwareCode(softwareCode);
        row.setSourceBudget(request.sourceBudget());
        row.setPrimaryCategory(request.primaryCategory());
        row.setSubCategory(request.subCategory());
        row.setBusinessCriticality(request.businessCriticality());
        row.setStrategy(request.strategy());
        row.setErp(request.erp());
        row.setCostCode(request.costCode());
        row.setLocation(request.location());
        row.setVendorId(request.vendorId());
        row.setSoftwareName(request.softwareName());
        row.setBaselineBudget(request.baselineBudget());
        row.setSoftwareSpend(request.softwareSpend());
        row.setActuals(request.actuals());
        row.setRemaining(request.remaining());
        row.setManagedServiceProviders(request.managedServiceProviders());
        row.setItStaffInternalLabour(request.itStaffInternalLabour());
        row.setItStaffExternalLabour(request.itStaffExternalLabour());
        row.setDepreciationAmortisation(request.depreciationAmortisation());
        row.setCloudSolutions(request.cloudSolutions());
        row.setConsultingOutsideServices(request.consultingOutsideServices());
        row.setTotalTco(request.totalTco());
        row.setCostRecoveries(request.costRecoveries());
        FinanceView saved = repository.saveAndFlush(row);
        entityManager.clear();
        // Imported per-cost-code breakdown rows (costCode present) are pure TCO/budget
        // data and shouldn't each independently drive Inventory totals or License cost.
        if (costCode == null) {
            inventoryService.ensureInventoryRow(TenantContext.get(), softwareCode, request.softwareName(),
                    request.softwareSpend());
            contractService.syncAnnualLicenseCostFromFinance(
                    TenantContext.get(), softwareCode, request.softwareSpend());
        }
        return FinanceViewRow.from(repository.findById(saved.getId()).orElse(saved));
    }

    public FinanceViewRow update(Long id, CreateFinanceViewRequest request) {
        validateCriticalityAndStrategy(request);
        // Hibernate's DISCRIMINATOR multi-tenancy binds the resolved tenant once per
        // request session, so an admin editing another tenant's row via JPA would
        // 404 even though @PreAuthorize allowed it. Route admins through JdbcTemplate
        // (raw SQL), which bypasses that filter entirely — same fix as VendorService.
        if (isCurrentUserAdmin()) {
            return updateAdmin(id, request);
        }
        FinanceView row = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Finance row not found"));
        String softwareCode = row.getSoftwareCode();
        applyRequest(row, request);
        FinanceView saved = repository.saveAndFlush(row);
        entityManager.clear();
        if (request.costCode() == null || request.costCode().isBlank()) {
            inventoryService.ensureInventoryRow(TenantContext.get(), softwareCode, request.softwareName(),
                    request.softwareSpend());
            contractService.syncAnnualLicenseCostFromFinance(
                    TenantContext.get(), softwareCode, request.softwareSpend());
        }
        return FinanceViewRow.from(repository.findById(saved.getId()).orElse(saved));
    }

    private FinanceViewRow updateAdmin(Long id, CreateFinanceViewRequest request) {
        int updated = jdbcTemplate.update(
                """
                        UPDATE finance_view SET
                          source_budget = ?, primary_category = ?, sub_category = ?, business_criticality = ?,
                          strategy = ?, erp = ?, cost_code = ?, location = ?, vendor_id = ?, software_name = ?,
                          baseline_budget = ?, software_spend = ?, actuals = ?, remaining = ?,
                          managed_service_providers = ?, it_staff_internal_labour = ?, it_staff_external_labour = ?,
                          depreciation_amortisation = ?, cloud_solutions = ?, consulting_outside_services = ?,
                          total_tco = ?, cost_recoveries = ?
                        WHERE id = ?
                        """,
                request.sourceBudget(), request.primaryCategory(), request.subCategory(),
                request.businessCriticality(), request.strategy(), request.erp(), request.costCode(),
                request.location(), request.vendorId(), request.softwareName(), request.baselineBudget(),
                request.softwareSpend(), request.actuals(), request.remaining(), request.managedServiceProviders(),
                request.itStaffInternalLabour(), request.itStaffExternalLabour(), request.depreciationAmortisation(),
                request.cloudSolutions(), request.consultingOutsideServices(), request.totalTco(),
                request.costRecoveries(), id);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Finance row not found");
        }
        Long tenantId = queryLong("SELECT tenant_id FROM finance_view WHERE id = ?", id);
        String softwareCode = jdbcTemplate.queryForObject(
                "SELECT software_code FROM finance_view WHERE id = ?", String.class, id);
        entityManager.clear();
        if (request.costCode() == null || request.costCode().isBlank()) {
            inventoryService.ensureInventoryRow(
                    tenantId, softwareCode, request.softwareName(), request.softwareSpend());
            contractService.syncAnnualLicenseCostFromFinance(tenantId, softwareCode, request.softwareSpend());
        }
        return findByIdAdmin(id);
    }

    private FinanceViewRow findByIdAdmin(Long id) {
        return jdbcTemplate.query(
                "SELECT * FROM finance_view WHERE id = ?", this::mapFinanceRow, id)
                .stream()
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Finance row not found"));
    }

    private FinanceViewRow mapFinanceRow(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new FinanceViewRow(
                rs.getLong("id"),
                rs.getString("software_code"),
                rs.getLong("tenant_id"),
                rs.getString("source_budget"),
                rs.getString("primary_category"),
                rs.getString("sub_category"),
                rs.getString("business_criticality"),
                rs.getString("strategy"),
                rs.getString("erp"),
                rs.getString("cost_code"),
                rs.getString("location"),
                (Integer) rs.getObject("vendor_id"),
                rs.getString("software_name"),
                rs.getBigDecimal("baseline_budget"),
                rs.getBigDecimal("software_spend"),
                rs.getBigDecimal("actuals"),
                rs.getBigDecimal("remaining"),
                rs.getBigDecimal("managed_service_providers"),
                rs.getBigDecimal("it_staff_internal_labour"),
                rs.getBigDecimal("it_staff_external_labour"),
                rs.getBigDecimal("depreciation_amortisation"),
                rs.getBigDecimal("cloud_solutions"),
                rs.getBigDecimal("consulting_outside_services"),
                rs.getBigDecimal("total_tco"),
                rs.getBigDecimal("cost_recoveries"));
    }

    private Long queryLong(String sql, Object... args) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class, args);
        return value;
    }

    private void validateCriticalityAndStrategy(CreateFinanceViewRequest request) {
        if (request.businessCriticality() != null && !request.businessCriticality().isBlank()
                && !VALID_CRITICALITY.contains(request.businessCriticality())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid businessCriticality value");
        }
        if (request.strategy() != null && !request.strategy().isBlank()
                && !VALID_STRATEGY.contains(request.strategy())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid strategy value");
        }
    }

    private void applyRequest(FinanceView row, CreateFinanceViewRequest request) {
        row.setSourceBudget(request.sourceBudget());
        row.setPrimaryCategory(request.primaryCategory());
        row.setSubCategory(request.subCategory());
        row.setBusinessCriticality(request.businessCriticality());
        row.setStrategy(request.strategy());
        row.setErp(request.erp());
        row.setCostCode(request.costCode());
        row.setLocation(request.location());
        row.setVendorId(request.vendorId());
        row.setSoftwareName(request.softwareName());
        row.setBaselineBudget(request.baselineBudget());
        row.setSoftwareSpend(request.softwareSpend());
        row.setActuals(request.actuals());
        row.setRemaining(request.remaining());
        row.setManagedServiceProviders(request.managedServiceProviders());
        row.setItStaffInternalLabour(request.itStaffInternalLabour());
        row.setItStaffExternalLabour(request.itStaffExternalLabour());
        row.setDepreciationAmortisation(request.depreciationAmortisation());
        row.setCloudSolutions(request.cloudSolutions());
        row.setConsultingOutsideServices(request.consultingOutsideServices());
        row.setTotalTco(request.totalTco());
        row.setCostRecoveries(request.costRecoveries());
    }

    private boolean isCurrentUserAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    // Creates or overwrites the actual spend recorded for a software/month, then
    // returns that month's actuals, its Software Spend (unaffected by this
    // recording, since it comes from the prior month's rollover), and Remaining.
    public FinanceViewRow addMonthlyActual(String softwareCode, AddMonthlyActualRequest request) {
        BigDecimal amount = request.amount();
        if (amount == null || amount.signum() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "amount must be zero or a positive number");
        }
        if (request.year() == null || request.month() == null || request.month() < 1 || request.month() > 12) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "year and month (1-12) are required");
        }
        FinanceView row = repository.findFirstBySoftwareCodeOrderByCostCodeAsc(softwareCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Finance row not found"));
        if (!isCurrentUserAdmin() && !row.getTenantId().equals(TenantContext.get())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Finance row not found");
        }

        Long tenantId = TenantContext.get();
        FinanceMonthlyActual record = monthlyActualRepository
                .findByTenantIdAndSoftwareCodeAndYearAndMonth(tenantId, softwareCode, request.year(), request.month())
                .orElseGet(FinanceMonthlyActual::new);
        record.setSoftwareCode(softwareCode);
        record.setYear(request.year());
        record.setMonth(request.month());
        record.setAmount(amount);
        monthlyActualRepository.saveAndFlush(record);

        BigDecimal spend = softwareSpendRepository
                .findByTenantIdAndSoftwareCodeAndYearAndMonth(tenantId, softwareCode, request.year(), request.month())
                .map(FinanceMonthlySoftwareSpend::getAmount)
                .orElse(row.getSoftwareSpend());
        BigDecimal remaining = row.getBaselineBudget() != null && spend != null
                ? row.getBaselineBudget().subtract(spend)
                : row.getRemaining();

        return FinanceViewRow.forMonth(row, amount, spend, remaining);
    }
}
