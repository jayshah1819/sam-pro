package com.samtracker.fileimport;

import java.math.BigDecimal;

// Best-effort fields pulled from an uploaded file — all nullable since extraction is
// heuristic (no AI); the frontend preview lets the user fill in/correct anything missing
// before it's saved as a Vendor/Contract/License.
public record ExtractedRecord(
                String vendorName,
                String vendorJDENumber,
                String contractNumber,
                String startDate,
                String endDate,
                BigDecimal value,
                String licenseName,
                String softwareName,
                Integer seatsPurchased,
                BigDecimal price,
                String source) {
}
