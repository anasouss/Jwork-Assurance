package com.assurance.security;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

public final class PermissionDependencies {

    private static final Set<String> WITHOUT_VIEW_DEPENDENCY = Set.of(
            "agence:manage-self"
    );

    private static final Map<String, Set<String>> CROSS_RESOURCE_DEPENDENCIES = Map.of(
            "user:manage", Set.of("role:view"),
            "avenant:view", Set.of("contrat:view"),
            "assistance:view", Set.of("contrat:view"),
            "carte-verte:view", Set.of("contrat:view"),
            "piece-jointe:view", Set.of("contrat:view")
    );

    private PermissionDependencies() {
    }

    public static Set<String> requiredFor(String code) {
        if (code == null || code.isBlank()) {
            return Set.of();
        }
        Set<String> required = new LinkedHashSet<>(CROSS_RESOURCE_DEPENDENCIES.getOrDefault(code, Set.of()));
        if (code.endsWith(":view") || WITHOUT_VIEW_DEPENDENCY.contains(code)) {
            return Set.copyOf(required);
        }
        int separator = code.indexOf(':');
        if (separator <= 0) {
            return Set.copyOf(required);
        }
        required.add(code.substring(0, separator) + ":view");
        return Set.copyOf(required);
    }
}
