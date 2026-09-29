package com.samtracker.finance;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/finance/categories")
public class FinanceCategoryController {

    private final FinanceCategoryRepository repository;

    public FinanceCategoryController(FinanceCategoryRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','VIEWER')")
    public List<FinanceCategory> getAll() {
        return repository.findAllByOrderByPrimaryCategoryAscSubCategoryAsc();
    }
}
