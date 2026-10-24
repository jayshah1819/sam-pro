package com.samtracker.integration;

import com.samtracker.integration.IntegrationDtos.ErrorResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = IntegrationVendorController.class)
@ConditionalOnProperty(name = "integration.enabled", havingValue = "true")
public class IntegrationExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> status(ResponseStatusException e) {
        HttpStatusCode code = e.getStatusCode();
        String error = code.value() == 404 ? "NOT_FOUND" : code.value() == 400 ? "BAD_REQUEST" : "ERROR";
        return ResponseEntity.status(code).body(new ErrorResponse(error, e.getReason()));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> badArgument(MethodArgumentTypeMismatchException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse("BAD_REQUEST", "Invalid value for parameter '" + e.getName() + "'"));
    }
}
