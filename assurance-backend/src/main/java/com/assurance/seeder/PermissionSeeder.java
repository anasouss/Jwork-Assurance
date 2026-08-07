package com.assurance.seeder;

import com.assurance.entity.Permission;
import com.assurance.repository.PermissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

@Component
@Order(1)
@RequiredArgsConstructor
public class PermissionSeeder implements CommandLineRunner {

    private static final List<Definition> DEFINITIONS = List.of(
            permission("contrat:view", "Consulter les contrats", "contrat"),
            permission("contrat:create", "Creer un contrat", "contrat"),
            permission("contrat:update", "Modifier un contrat", "contrat"),
            permission("contrat:delete", "Supprimer un contrat brouillon", "contrat"),
            permission("contrat:renew", "Renouveler un contrat", "contrat"),
            permission("contrat:recalculate-financial-history", "Recalculer l'historique financier", "contrat"),

            permission("avenant:view", "Consulter les avenants", "avenant"),
            permission("avenant:create", "Creer un avenant", "avenant"),
            permission("avenant:draft", "Gerer les brouillons d'avenant", "avenant"),
            permission("avenant:rectify", "Rectifier un avenant", "avenant"),
            permission("avenant:delete", "Supprimer le dernier avenant", "avenant"),

            permission("client:view", "Consulter les clients", "client"),
            permission("client:create", "Creer un client", "client"),
            permission("client:manage", "Gerer les clients et leurs groupes", "client"),
            permission("vehicule:view", "Rechercher les vehicules", "vehicule"),

            permission("garantie:view", "Consulter les garanties", "garantie"),
            restricted("garantie:manage", "Gerer les garanties", "garantie"),
            permission("grille-tarifaire:view", "Consulter les grilles tarifaires", "grille-tarifaire"),
            permission("grille-tarifaire:manage", "Gerer les grilles tarifaires", "grille-tarifaire"),

            permission("quittance:view", "Consulter les quittances", "quittance"),
            permission("quittance:create", "Creer une quittance", "quittance"),
            permission("quittance:manage", "Gerer les regles de quittance", "quittance"),
            permission("reglement-client:view", "Consulter les règlements clients", "reglement-client"),
            permission("reglement-client:create", "Enregistrer un règlement client", "reglement-client"),
            permission("reglement-client:manage", "Annuler et corriger les règlements clients", "reglement-client"),
            permission("tresorerie:view", "Consulter la trésorerie", "tresorerie"),
            permission("tresorerie:manage", "Gérer les comptes et opérations de trésorerie", "tresorerie"),
            permission("regle-fiscale:view", "Consulter les règles fiscales", "regle-fiscale"),
            permission("regle-fiscale:manage", "Gérer les règles fiscales", "regle-fiscale"),

            permission("assistance:view", "Consulter les assistances", "assistance"),
            permission("assistance:manage", "Gerer les assistances", "assistance"),
            permission("carte-verte:view", "Consulter les cartes vertes", "carte-verte"),
            permission("carte-verte:manage", "Gerer les cartes vertes", "carte-verte"),
            permission("piece-jointe:view", "Consulter les pieces jointes", "piece-jointe"),
            permission("piece-jointe:manage", "Gerer les pieces jointes", "piece-jointe"),

            permission("attestation-stock:view", "Consulter le stock d'attestations", "attestation-stock"),
            permission("attestation-stock:manage", "Gerer le stock d'attestations", "attestation-stock"),
            permission("attestation-stock:cancel", "Annuler une attestation", "attestation-stock"),

            restricted("agence:view", "Consulter les agences", "agence"),
            restricted("agence:create", "Creer une agence", "agence"),
            permission("agence:manage-self", "Modifier les informations de son agence", "agence"),
            permission("user:view", "Consulter les utilisateurs", "admin"),
            permission("user:manage", "Gerer les utilisateurs", "admin"),
            permission("role:view", "Consulter les roles", "admin"),
            permission("role:manage", "Gerer les roles", "admin"),
            restricted("config:view", "Consulter la configuration", "config"),
            restricted("config:manage", "Gerer la configuration", "config"),
            permission("referentiel:view", "Consulter les referentiels", "referentiel"),
            permission("referentiel:manage", "Gerer les referentiels", "referentiel"),
            permission("contact-compagnie:view", "Consulter les contacts compagnie", "contact-compagnie"),
            permission("contact-compagnie:manage", "Gérer les contacts compagnie", "contact-compagnie"),

            permission("sinistre:view", "Consulter les sinistres", "sinistre"),
            permission("sinistre:create", "Déclarer un sinistre", "sinistre"),
            permission("sinistre:manage", "Gérer les dossiers sinistre", "sinistre"),
            permission("sinistre:finance", "Gérer les opérations financières des sinistres", "sinistre"),
            permission("sinistre:referentiel", "Gérer les experts et garages", "sinistre")
    );

    private final PermissionRepository permissionRepository;

    @Override
    @Transactional
    public void run(String... args) {
        for (Definition definition : DEFINITIONS) {
            Permission permission = permissionRepository.findByCode(definition.code())
                    .orElseGet(() -> Permission.builder().code(definition.code()).build());
            if (apply(permission, definition)) {
                permissionRepository.save(permission);
            }
        }
    }

    private boolean apply(Permission permission, Definition definition) {
        boolean changed = permission.getId() == null;
        if (!Objects.equals(permission.getNom(), definition.name())) {
            permission.setNom(definition.name());
            changed = true;
        }
        if (!Objects.equals(permission.getModule(), definition.module())) {
            permission.setModule(definition.module());
            changed = true;
        }
        if (!Objects.equals(permission.getDescription(), definition.description())) {
            permission.setDescription(definition.description());
            changed = true;
        }
        if (!Objects.equals(permission.getSuperAdminOnly(), definition.superAdminOnly())) {
            permission.setSuperAdminOnly(definition.superAdminOnly());
            changed = true;
        }
        return changed;
    }

    private static Definition permission(String code, String name, String module) {
        return new Definition(code, name, module, null, false);
    }

    private static Definition restricted(String code, String name, String module) {
        return new Definition(code, name, module, null, true);
    }

    private record Definition(
            String code,
            String name,
            String module,
            String description,
            boolean superAdminOnly
    ) {
    }
}
