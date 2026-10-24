package com.samtracker.fileimport;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// No AI/external calls here on purpose — extraction is local header/keyword/regex
// heuristics only, so uploaded documents never leave the server.
@Service
public class FileExtractionService {

    private static final Map<String, List<String>> HEADER_SYNONYMS = new LinkedHashMap<>();
    static {
        HEADER_SYNONYMS.put("vendorName", List.of("vendor name", "vendor", "supplier", "company name", "company"));
        HEADER_SYNONYMS.put("vendorJDENumber", List.of("vendor jde", "jde number", "jde #", "jde"));
        HEADER_SYNONYMS.put("contractNumber",
                List.of("contract number", "contract #", "contract no", "po number", "agreement number",
                        "agreement #"));
        HEADER_SYNONYMS.put("startDate", List.of("start date", "effective date", "begin date"));
        HEADER_SYNONYMS.put("endDate", List.of("end date", "expiry date", "expiration date", "renewal date"));
        HEADER_SYNONYMS.put("value", List.of("contract value", "total value", "value"));
        HEADER_SYNONYMS.put("price", List.of("price", "amount", "cost", "spend", "total"));
        HEADER_SYNONYMS.put("licenseName", List.of("license name", "license"));
        HEADER_SYNONYMS.put("softwareName", List.of("software name", "software", "product name", "product"));
        HEADER_SYNONYMS.put("seatsPurchased", List.of("seat count", "seats", "quantity", "qty"));
    }

    private static final DateTimeFormatter[] DATE_FORMATS = {
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("M/d/yyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("d-M-yyyy"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd"),
            DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.ENGLISH),
    };

    private static final Pattern SLASH_DATE = Pattern.compile("\\b\\d{1,2}/\\d{1,2}/\\d{2,4}\\b");
    private static final Pattern ISO_DATE = Pattern.compile("\\b\\d{4}-\\d{2}-\\d{2}\\b");
    private static final Pattern WORD_DATE = Pattern
            .compile("\\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{1,2},?\\s+\\d{4}\\b");
    private static final Pattern MONEY = Pattern.compile("\\$\\s?[\\d,]+(?:\\.\\d{2})?");

    public List<ExtractedRecord> extract(MultipartFile file) {
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        try {
            if (name.endsWith(".csv")) {
                return extractFromCsv(file);
            }
            if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
                return extractFromSpreadsheet(file);
            }
            if (name.endsWith(".pdf")) {
                return List.of(extractFromPdf(file));
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read file: " + e.getMessage());
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Unsupported file type — upload .xlsx, .csv, or .pdf");
    }

    private List<ExtractedRecord> extractFromCsv(MultipartFile file) throws IOException {
        try (var reader = new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8)) {
            CSVParser parser = CSVFormat.DEFAULT.builder()
                    .setHeader()
                    .setSkipHeaderRecord(true)
                    .setIgnoreSurroundingSpaces(true)
                    .setTrim(true)
                    .get()
                    .parse(reader);
            Map<String, String> headerToField = new LinkedHashMap<>();
            for (String header : parser.getHeaderNames()) {
                String field = matchField(header);
                if (field != null) {
                    headerToField.put(header, field);
                }
            }
            List<ExtractedRecord> records = new ArrayList<>();
            for (CSVRecord row : parser) {
                Map<String, String> values = new LinkedHashMap<>();
                headerToField.forEach((header, field) -> {
                    if (row.isMapped(header)) {
                        values.put(field, row.get(header));
                    }
                });
                records.add(buildRecord(values, "Row " + (row.getRecordNumber() + 1)));
            }
            return records;
        }
    }

    private List<ExtractedRecord> extractFromSpreadsheet(MultipartFile file) throws IOException {
        try (var workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(sheet.getFirstRowNum());
            if (headerRow == null) {
                return List.of();
            }
            Map<Integer, String> columnFields = new LinkedHashMap<>();
            for (Cell cell : headerRow) {
                String field = matchField(cellText(cell));
                if (field != null) {
                    columnFields.put(cell.getColumnIndex(), field);
                }
            }
            List<ExtractedRecord> records = new ArrayList<>();
            for (int r = headerRow.getRowNum() + 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) {
                    continue;
                }
                Map<String, String> values = new LinkedHashMap<>();
                columnFields.forEach((columnIndex, field) -> {
                    String text = cellText(row.getCell(columnIndex));
                    if (text != null && !text.isBlank()) {
                        values.put(field, text);
                    }
                });
                if (!values.isEmpty()) {
                    records.add(buildRecord(values, "Row " + (r + 1)));
                }
            }
            return records;
        }
    }

    private ExtractedRecord extractFromPdf(MultipartFile file) throws IOException {
        String text;
        try (PDDocument document = Loader.loadPDF(file.getBytes())) {
            text = new PDFTextStripper().getText(document);
        }
        String vendorName = findLabeledValue(text, "vendor", "supplier", "bill from", "company");
        if (vendorName == null) {
            vendorName = firstNonBlankLine(text);
        }
        String contractNumber = findLabeledValue(text, "contract number", "contract #", "po number",
                "agreement number");
        String licenseName = findLabeledValue(text, "license name", "license");
        String softwareName = findLabeledValue(text, "software name", "software", "product");
        List<LocalDate> dates = findDates(text);
        BigDecimal amount = findLargestMoney(text);
        String startDate = dates.isEmpty() ? null : dates.get(0).toString();
        String endDate = dates.size() > 1 ? dates.get(1).toString() : null;
        return new ExtractedRecord(vendorName, null, contractNumber, startDate, endDate, amount, licenseName,
                softwareName, null, amount, "PDF text");
    }

    private String matchField(String headerText) {
        if (headerText == null) {
            return null;
        }
        String normalized = headerText.trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return null;
        }
        for (var entry : HEADER_SYNONYMS.entrySet()) {
            for (String synonym : entry.getValue()) {
                if (normalized.equals(synonym) || normalized.contains(synonym)) {
                    return entry.getKey();
                }
            }
        }
        return null;
    }

    private ExtractedRecord buildRecord(Map<String, String> raw, String source) {
        return new ExtractedRecord(
                trimToNull(raw.get("vendorName")),
                trimToNull(raw.get("vendorJDENumber")),
                trimToNull(raw.get("contractNumber")),
                parseDate(raw.get("startDate")),
                parseDate(raw.get("endDate")),
                parseMoney(raw.get("value")),
                trimToNull(raw.get("licenseName")),
                trimToNull(raw.get("softwareName")),
                parseInt(raw.get("seatsPurchased")),
                parseMoney(raw.get("price")),
                source);
    }

    private String cellText(Cell cell) {
        if (cell == null) {
            return null;
        }
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getLocalDateTimeCellValue().toLocalDate().toString();
                }
                double num = cell.getNumericCellValue();
                return num == Math.floor(num) && !Double.isInfinite(num)
                        ? String.valueOf((long) num)
                        : String.valueOf(num);
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                try {
                    return cell.getStringCellValue();
                } catch (IllegalStateException e) {
                    return String.valueOf(cell.getNumericCellValue());
                }
            default:
                return null;
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String parseDate(String raw) {
        String value = trimToNull(raw);
        if (value == null) {
            return null;
        }
        if (ISO_DATE.matcher(value).matches()) {
            return value;
        }
        for (DateTimeFormatter format : DATE_FORMATS) {
            try {
                return LocalDate.parse(value, format).toString();
            } catch (DateTimeParseException ignored) {
                // try the next format
            }
        }
        return null;
    }

    private BigDecimal parseMoney(String raw) {
        String value = trimToNull(raw);
        if (value == null) {
            return null;
        }
        String cleaned = value.replaceAll("[^0-9.\\-]", "");
        if (cleaned.isEmpty() || cleaned.equals("-")) {
            return null;
        }
        try {
            return new BigDecimal(cleaned);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Integer parseInt(String raw) {
        String value = trimToNull(raw);
        if (value == null) {
            return null;
        }
        String cleaned = value.replaceAll("[^0-9\\-]", "");
        if (cleaned.isEmpty()) {
            return null;
        }
        try {
            return Integer.parseInt(cleaned);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String findLabeledValue(String text, String... labels) {
        for (String line : text.split("\\r?\\n")) {
            String normalized = line.trim();
            for (String label : labels) {
                Pattern pattern = Pattern.compile("(?i)^" + Pattern.quote(label) + "\\s*[:\\-]\\s*(.+)$");
                Matcher matcher = pattern.matcher(normalized);
                if (matcher.matches()) {
                    String value = trimToNull(matcher.group(1));
                    if (value != null) {
                        return value;
                    }
                }
            }
        }
        return null;
    }

    private String firstNonBlankLine(String text) {
        for (String line : text.split("\\r?\\n")) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty()) {
                return trimmed.length() > 80 ? trimmed.substring(0, 80) : trimmed;
            }
        }
        return null;
    }

    private List<LocalDate> findDates(String text) {
        TreeSet<LocalDate> found = new TreeSet<>();
        for (Pattern pattern : List.of(ISO_DATE, SLASH_DATE, WORD_DATE)) {
            Matcher matcher = pattern.matcher(text);
            while (matcher.find()) {
                String candidate = parseDate(matcher.group());
                if (candidate != null) {
                    found.add(LocalDate.parse(candidate));
                }
            }
        }
        return new ArrayList<>(found);
    }

    private BigDecimal findLargestMoney(String text) {
        BigDecimal largest = null;
        Matcher matcher = MONEY.matcher(text);
        while (matcher.find()) {
            BigDecimal amount = parseMoney(matcher.group());
            if (amount != null && (largest == null || amount.compareTo(largest) > 0)) {
                largest = amount;
            }
        }
        return largest;
    }
}
