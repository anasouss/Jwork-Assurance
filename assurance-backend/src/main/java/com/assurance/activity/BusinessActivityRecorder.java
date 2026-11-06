package com.assurance.activity;

import com.assurance.entity.BusinessActivity;
import com.assurance.entity.Utilisateur;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.BusinessActivityRepository;
import com.assurance.repository.UtilisateurRepository;
import com.assurance.security.AuditRequestContext;
import com.assurance.security.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
public class BusinessActivityRecorder {
    private final BusinessActivityRepository repository;
    private final AgenceRepository agenceRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final ObjectMapper objectMapper;
    private final ThreadLocal<List<ActivityCommand>> operation = new ThreadLocal<>();

    /** Explicit service workflow boundary, not an HTTP-request or time-based grouping. */
    @Transactional(propagation = Propagation.MANDATORY)
    public <T> T perform(Supplier<T> work, Function<T, ActivityCommand> summarize) {
        if (operation.get() != null) {
            T result = work.get();
            ActivityCommand command = summarize.apply(result);
            if (command != null) record(command);
            return result;
        }
        List<ActivityCommand> supportingActions = new ArrayList<>();
        operation.set(supportingActions);
        try {
            T result = work.get();
            ActivityCommand command = summarize.apply(result);
            if (command != null) {
                var references = new LinkedHashMap<String, ActivityReference>();
                var changes = new LinkedHashMap<String, ActivityChange>();
                command.changes().forEach(change -> changes.put(change.label(), change));
                for (ActivityCommand supporting : supportingActions) {
                    // Platform workflows can touch several agencies. Never expose one
                    // agency's details through another agency's aggregate event.
                    if (!Objects.equals(command.agenceId(), supporting.agenceId())) continue;
                    addReference(references, supporting.subject());
                    supporting.references().forEach(reference -> addReference(references, reference));
                    for (ActivityChange change : supporting.changes()) {
                        boolean sameSubject = referenceKey(supporting.subject()).equals(referenceKey(command.subject()));
                        String label = sameSubject ? change.label() : supporting.subject().label() + " - " + change.label();
                        if (label.length() > 1000) label = label.substring(0, 997) + "...";
                        changes.putIfAbsent(label, new ActivityChange(label, change.beforeValue(), change.afterValue()));
                    }
                }
                command.references().forEach(reference -> addReference(references, reference));
                references.remove(referenceKey(command.subject()));
                operation.remove();
                supportingActions.stream()
                        .filter(supporting -> !Objects.equals(command.agenceId(), supporting.agenceId()))
                        .forEach(this::record);
                record(new ActivityCommand(command.agenceId(), command.module(), command.action(),
                        command.title(), command.origin(), command.subject(),
                        List.copyOf(references.values()), List.copyOf(changes.values())));
            } else {
                operation.remove();
                supportingActions.forEach(this::record);
            }
            return result;
        } finally {
            operation.remove();
        }
    }

    private static void addReference(LinkedHashMap<String, ActivityReference> references, ActivityReference reference) {
        references.put(referenceKey(reference), reference);
    }

    private static String referenceKey(ActivityReference reference) {
        return reference.type().name() + ":" + reference.id();
    }

    // A business event must roll back with its operation, never commit independently.
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(ActivityCommand command) {
        Long currentAgency = TenantContext.getCurrentAgence();
        if (currentAgency != null && !Objects.equals(currentAgency, command.agenceId())) {
            throw new AccessDeniedException("Activite hors du perimetre de l'agence");
        }
        if ((command.action() == ActivityAction.UPDATED || command.action() == ActivityAction.SAVED
                || command.action() == ActivityAction.RECALCULATED) && command.changes().isEmpty()) {
            return;
        }
        if (operation.get() != null) {
            operation.get().add(command);
            return;
        }
        Long actorId = TenantContext.getCurrentUser();
        Utilisateur actor = actorId == null ? null : utilisateurRepository.findById(actorId)
                .orElseThrow(() -> new IllegalStateException("Operateur de l'activite introuvable"));
        persist(command, actor);
    }

    /** Global administrative facts stay invisible in an agency-scoped history. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void recordPlatform(ActivityCommand command) {
        Long actorId = TenantContext.getCurrentUser();
        Utilisateur actor = actorId == null ? null : utilisateurRepository.findById(actorId).orElse(null);
        if (command.agenceId() != null || command.module() != ActivityModule.ADMINISTRATION
                || actor == null || actor.getAgence() != null || !"SUPER_ADMIN".equalsIgnoreCase(actor.getRoleCode())) {
            throw new AccessDeniedException("Activite reservee a l'administration plateforme");
        }
        if ((command.action() == ActivityAction.UPDATED || command.action() == ActivityAction.SAVED)
                && command.changes().isEmpty()) return;
        // Deliberately not merged into a selected agency's operation scope.
        persist(command, actor);
    }

    /** Only explicit global-reference writers use this path, never tenant-owned operations. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void recordGlobalReference(ActivityCommand command) {
        Long actorId = TenantContext.getCurrentUser();
        Utilisateur actor = actorId == null ? null : utilisateurRepository.findById(actorId).orElse(null);
        java.util.Set<String> permissions = switch (command.subject().type()) {
            case REGLE_FISCALE -> java.util.Set.of("regle-fiscale:manage", "config:manage");
            case AJUSTEMENT_TARIF_USAGE, COMPAGNIE, COMPAGNIE_ASSISTANCE, PRODUIT_ASSISTANCE, TARIF_ASSISTANCE, CODE_PROMO_ASSISTANCE ->
                    java.util.Set.of("referentiel:manage", "config:manage");
            case USAGE, CONFIGURATION_USAGES, TARIF_USAGE, MARQUE, CARROSSERIE, CARBURANT, SOUS_CLASSE,
                    CATEGORIE_CLIENT, CATEGORIE_TRANSPORT, GROUPE_USAGE_ATTESTATION, GROUPE_EXCLUSION_GARANTIE, GARANTIE ->
                    java.util.Set.of("referentiel:manage");
            case GRILLE_TARIFAIRE, LIGNE_GRILLE_TARIFAIRE, FORMULE_GARANTIE_PERSONNE ->
                    java.util.Set.of("grille-tarifaire:manage", "referentiel:manage", "config:manage");
            default -> java.util.Set.of();
        };
        ActivityModule expectedModule = switch (command.subject().type()) {
            case COMPAGNIE, COMPAGNIE_ASSISTANCE, PRODUIT_ASSISTANCE, TARIF_ASSISTANCE, CODE_PROMO_ASSISTANCE -> ActivityModule.COMPAGNIES;
            case GRILLE_TARIFAIRE, LIGNE_GRILLE_TARIFAIRE, FORMULE_GARANTIE_PERSONNE -> ActivityModule.COMPAGNIES;
            default -> ActivityModule.REFERENTIELS;
        };
        if (command.agenceId() != null || command.module() != expectedModule || permissions.isEmpty()
                || actor == null || permissions.stream().noneMatch(actor.getPermissions()::contains)) {
            throw new AccessDeniedException("Activite de referentiel global non autorisee");
        }
        if ((command.action() == ActivityAction.UPDATED || command.action() == ActivityAction.SAVED
                || command.action() == ActivityAction.RECALCULATED) && command.changes().isEmpty()) return;
        // Global configuration must not inherit a selected agency's private context.
        persist(command, actor);
    }

    private void persist(ActivityCommand command, Utilisateur actor) {
        repository.save(BusinessActivity.builder()
                .agence(command.agenceId() == null ? null : agenceRepository.getReferenceById(command.agenceId()))
                .actor(actor)
                .actorName(actor == null ? "Systeme" : actor.getFullName())
                .occurredAt(LocalDateTime.now())
                .module(command.module())
                .action(command.action())
                .title(command.title())
                .origin(command.origin())
                .surface(AuditRequestContext.getActivitySurface())
                .subjectType(command.subject().type())
                .subjectId(command.subject().id())
                .subjectLabel(command.subject().label())
                .referencesJson(json(command.references()))
                .changesJson(json(command.changes()))
                .requestId(AuditRequestContext.getRequestId())
                .build());
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Impossible d'enregistrer l'activite metier", exception);
        }
    }
}
