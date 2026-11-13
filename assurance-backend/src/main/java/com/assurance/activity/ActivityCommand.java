package com.assurance.activity;

import java.util.List;
import java.util.Objects;

public record ActivityCommand(
        Long agenceId,
        ActivityModule module,
        ActivityAction action,
        String title,
        String origin,
        ActivityReference subject,
        List<ActivityReference> references,
        List<ActivityChange> changes
) {
    public ActivityCommand {
        Objects.requireNonNull(module);
        Objects.requireNonNull(action);
        Objects.requireNonNull(subject);
        if (title == null || title.isBlank() || title.length() > 240) {
            throw new IllegalArgumentException("Titre d'activité invalide");
        }
        if (origin == null || origin.isBlank() || origin.length() > 100) {
            throw new IllegalArgumentException("Origine d'activité invalide");
        }
        references = references == null ? List.of() : List.copyOf(references);
        changes = changes == null ? List.of() : changes.stream().filter(ActivityChange::changed).toList();
    }
}
