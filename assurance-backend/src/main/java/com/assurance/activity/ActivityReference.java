package com.assurance.activity;

import java.util.Objects;

/** Immutable business identity; retained even when the source record is deleted. */
public record ActivityReference(ActivityRecordType type, String id, String label) {
    public ActivityReference {
        Objects.requireNonNull(type, "Le type de reference est obligatoire");
        if (id == null || id.isBlank() || id.length() > 80) {
            throw new IllegalArgumentException("Identifiant de reference invalide");
        }
        if (label == null || label.isBlank() || label.length() > 500) {
            throw new IllegalArgumentException("Libelle de reference invalide");
        }
    }

    public static ActivityReference of(ActivityRecordType type, Long id, String label) {
        return new ActivityReference(type, Objects.requireNonNull(id).toString(), label);
    }
}
