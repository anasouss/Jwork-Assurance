package com.assurance.enums;

import java.util.Locale;

public enum TypeAssistance {
    VOYAGE("Assistance Voyage"),
    AUTOMOBILE("Assistance Automobile");

    private final String libelle;

    TypeAssistance(String libelle) {
        this.libelle = libelle;
    }

    public String getLibelle() {
        return libelle;
    }

    public static TypeAssistance fromProductType(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (normalized.equals("ASSISTANCE VOYAGE") || normalized.equals("VOYAGE")) {
            return VOYAGE;
        }
        if (normalized.equals("ASSISTANCE AUTOMOBILE") || normalized.equals("AUTOMOBILE")) {
            return AUTOMOBILE;
        }
        return null;
    }
}
