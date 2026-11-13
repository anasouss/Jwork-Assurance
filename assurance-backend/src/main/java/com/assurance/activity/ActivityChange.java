package com.assurance.activity;

import java.util.Objects;

/** Display-ready, allowlisted values, never an entity dump or a request body. */
public record ActivityChange(String label, String beforeValue, String afterValue) {
    public ActivityChange {
        if (label == null || label.isBlank() || label.length() > 1000) {
            throw new IllegalArgumentException("Libellé de changement invalide");
        }
    }

    public boolean changed() {
        return !Objects.equals(beforeValue, afterValue);
    }
}
