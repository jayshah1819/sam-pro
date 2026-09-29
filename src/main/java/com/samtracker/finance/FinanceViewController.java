package com.samtracker.finance;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/finance/view")
public class FinanceViewController {

    private final FinanceViewService financeViewService;

    public FinanceViewController(FinanceViewService financeViewService) {
        this.financeViewService = financeViewService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','VIEWER')")
    public List<FinanceViewRow> getAll(
            @RequestParam(required = false) Integer year, @RequestParam(required = false) Integer month) {
        return financeViewService.findAllForCurrentUser(year, month);
    }

    @GetMapping("/options")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','VIEWER')")
    public FinanceViewOptions getOptions() {
        return new FinanceViewOptions(
                FinanceViewService.BUSINESS_CRITICALITY_OPTIONS, FinanceViewService.STRATEGY_OPTIONS);
    }

    @GetMapping("/monthly-report")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','VIEWER')")
    public List<MonthlyActualsReportRow> getMonthlyReport(@RequestParam(required = false) Integer year) {
        return financeViewService.getMonthlyActualsReport(year);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public ResponseEntity<FinanceViewRow> create(@Valid @RequestBody CreateFinanceViewRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(financeViewService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public FinanceViewRow update(
            @PathVariable Long id, @Valid @RequestBody CreateFinanceViewRequest request) {
        return financeViewService.update(id, request);
    }

    @GetMapping("/{softwareCode}/actuals")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','VIEWER')")
    public BigDecimal getMonthlyActual(
            @PathVariable String softwareCode, @RequestParam int year, @RequestParam int month) {
        return financeViewService.getMonthlyActual(softwareCode, year, month);
    }

    @PostMapping("/{softwareCode}/actuals")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public FinanceViewRow addMonthlyActual(
            @PathVariable String softwareCode, @Valid @RequestBody AddMonthlyActualRequest request) {
        return financeViewService.addMonthlyActual(softwareCode, request);
    }
}
