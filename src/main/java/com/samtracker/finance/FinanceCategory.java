package com.samtracker.finance;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// Shared Primary Category -> Sub-Category taxonomy used by the Finance "Detailed" tab.
// Not tenant-scoped: this is a common reference list, not tenant business data.
@Entity
@Table(name = "finance_category", uniqueConstraints = {
        @UniqueConstraint(name = "uq_finance_category", columnNames = { "primary_category", "sub_category" })
})
@Getter
@Setter
@NoArgsConstructor
public class FinanceCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "finance_category_id")
    private Long id;

    @Column(name = "primary_category", nullable = false)
    private String primaryCategory;

    @Column(name = "sub_category", nullable = false)
    private String subCategory;
}
