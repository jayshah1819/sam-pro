package com.samtracker.finance;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FinanceCategoryRepository extends JpaRepository<FinanceCategory, Long> {

    List<FinanceCategory> findAllByOrderByPrimaryCategoryAscSubCategoryAsc();
}
