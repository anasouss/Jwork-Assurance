package com.assurance.service;

import org.springframework.stereotype.Service;

import java.time.DateTimeException;
import java.time.LocalDate;

@Service
public class EcheanceService {

    public String normalizeCode(String rawCode) {
        if (rawCode == null) {
            return null;
        }
        String value = rawCode.trim().replace(" ", "");
        if (!value.matches("^\\d{1,2}/\\d{1,2}$")) {
            return null;
        }
        String[] parts = value.split("/");
        int day = Integer.parseInt(parts[0]);
        int month = Integer.parseInt(parts[1]);
        if (month < 1 || month > 12) {
            return null;
        }
        try {
            LocalDate.of(2024, month, day);
        } catch (DateTimeException ex) {
            return null;
        }
        return String.format("%02d/%02d", day, month);
    }

    public LocalDate resolveDateEcheance(LocalDate dateEffet, String rawCode, LocalDate fallbackDateEcheance) {
        if (dateEffet == null) {
            return fallbackDateEcheance;
        }
        String code = normalizeCode(rawCode);
        if (code == null) {
            return fallbackDateEcheance != null ? fallbackDateEcheance : dateEffet;
        }
        String[] parts = code.split("/");
        int day = Integer.parseInt(parts[0]);
        int month = Integer.parseInt(parts[1]);

        if (day == 1 && month == 1) {
            LocalDate expirationDate = LocalDate.of(dateEffet.getYear(), 12, 31);
            return expirationDate.isBefore(dateEffet) ? expirationDate.plusYears(1) : expirationDate;
        }

        LocalDate expirationDate = LocalDate.of(dateEffet.getYear(), month, day);
        if (!expirationDate.isAfter(dateEffet)) {
            expirationDate = expirationDate.plusYears(1);
        }
        return expirationDate.minusDays(1);
    }
}
