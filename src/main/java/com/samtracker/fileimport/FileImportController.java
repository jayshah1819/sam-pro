package com.samtracker.fileimport;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/imports")
public class FileImportController {

    private final FileExtractionService extractionService;

    public FileImportController(FileExtractionService extractionService) {
        this.extractionService = extractionService;
    }

    @PostMapping("/extract")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public List<ExtractedRecord> extract(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "file is required");
        }
        return extractionService.extract(file);
    }
}
