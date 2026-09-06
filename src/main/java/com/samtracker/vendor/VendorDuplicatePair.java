package com.samtracker.vendor;

public record VendorDuplicatePair(
                Integer vendorAId,
                String vendorAName,
                Integer vendorBId,
                String vendorBName,
                double similarity) {
}
