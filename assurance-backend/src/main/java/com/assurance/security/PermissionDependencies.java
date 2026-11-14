package com.assurance.security;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

public final class PermissionDependencies {

    private static final Set<String> WITHOUT_VIEW_DEPENDENCY = Set.of(
            "agence:manage-self"
    );

    private static final Map<String, Set<String>> CROSS_RESOURCE_DEPENDENCIES = Map.ofEntries(
            Map.entry("user:create", Set.of("user:assign-role")),
            Map.entry("user:assign-role", Set.of("role:view")),
            Map.entry("role:assign-permissions", Set.of("role:update")),
            Map.entry("avenant:view", Set.of("contrat:view")),
            Map.entry("avenant:create", Set.of("avenant:update-draft")),
            Map.entry("avenant:rectify", Set.of("avenant:update-draft")),
            Map.entry("assistance:view", Set.of("contrat:view")),
            Map.entry("carte-verte:view", Set.of("contrat:view")),
            Map.entry("piece-jointe:view", Set.of("contrat:view")),
            Map.entry("acquisition-client:update", Set.of("client:view")),
            Map.entry("condition-paiement:view", Set.of("client:view")),
            Map.entry("reglement-compagnie:view", Set.of("bordereau-compagnie:view")),
            Map.entry("groupe-client:view", Set.of("client:view")),
            Map.entry("document-crm:view", Set.of("client:view")),
            Map.entry("sinistre-document:upload", Set.of("sinistre:view")),
            Map.entry("sinistre-document:update", Set.of("sinistre:view")),
            Map.entry("sinistre-document:delete", Set.of("sinistre:view")),
            Map.entry("sinistre-mission:create", Set.of("sinistre:view")),
            Map.entry("sinistre-mission:update", Set.of("sinistre:view")),
            Map.entry("sinistre-provision:create", Set.of("sinistre:view")),
            Map.entry("sinistre-operation:create", Set.of("sinistre:view")),
            Map.entry("sinistre-operation:cancel", Set.of("sinistre:view")),
            Map.entry("rapprochement-bancaire:validate", Set.of("rapprochement-bancaire:update")),
            Map.entry("quittance-affectation:import", Set.of("quittance-affectation:update")),
            Map.entry("regle-quittance:view", Set.of("quittance-affectation:view")),
            Map.entry("tarif-assistance:view", Set.of("produit-assistance:view")),
            Map.entry("promo-assistance:view", Set.of("produit-assistance:view"))
    );

    private PermissionDependencies() {
    }

    public static Set<String> requiredFor(String code) {
        if (code == null || !PermissionCatalog.contains(code)) {
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
        String viewCode = code.substring(0, separator) + ":view";
        if (PermissionCatalog.contains(viewCode)) {
            required.add(viewCode);
        }
        return Set.copyOf(required);
    }
}
