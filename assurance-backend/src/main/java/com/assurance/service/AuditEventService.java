package com.assurance.service;

import com.assurance.dto.response.AuditEventResponse;
import com.assurance.dto.response.AuditOperationResponse;
import com.assurance.dto.response.PageMetadata;
import com.assurance.dto.response.PagedResponse;
import com.assurance.entity.AuditEvent;
import com.assurance.entity.Agence;
import com.assurance.entity.BaseEntity;
import com.assurance.entity.Contrat;
import com.assurance.entity.Remorque;
import com.assurance.entity.Utilisateur;
import com.assurance.entity.Vehicule;
import com.assurance.enums.AuditAction;
import com.assurance.enums.AuditActorType;
import com.assurance.repository.AuditEventRepository;
import com.assurance.repository.UtilisateurRepository;
import com.assurance.security.AuditRequestContext;
import com.assurance.security.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuditEventService {

    private static final int MAX_PAGE_SIZE = 100;

    private final AuditEventRepository auditEventRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public void recordAgencyContextChange(
            Utilisateur actor,
            Long sessionId,
            Agence before,
            Agence after
    ) {
        auditEventRepository.save(AuditEvent.agencyContextChanged(
                after != null ? after.getId() : before != null ? before.getId() : null,
                actor.getId(),
                actor.getFullName(),
                String.valueOf(sessionId),
                contextJson(before),
                contextJson(after),
                AuditRequestContext.getRequestId(),
                AuditRequestContext.getSource(),
                AuditRequestContext.getOperationCode()
        ));
    }

    @Transactional
    public void recordContractVehicleSaved(Long agenceId, Vehicule vehicule, boolean created) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("contrat", contractReference(vehicule.getContrat()));
        snapshot.put("immatriculation", vehicule.getImmatriculation());
        snapshot.put("immatriculationProvisoire", vehicule.getImmatriculationProvisoire());
        snapshot.put("usage", reference("Usage", vehicule.getUsage(),
                vehicule.getUsage() == null ? null : joinReference(vehicule.getUsage().getCode(), vehicule.getUsage().getLibelle())));
        snapshot.put("marque", reference("Marque", vehicule.getMarque(),
                vehicule.getMarque() == null ? null : vehicule.getMarque().getLibelle()));
        snapshot.put("carrosserie", reference("Carrosserie", vehicule.getCarrosserie(),
                vehicule.getCarrosserie() == null ? null : vehicule.getCarrosserie().getLibelle()));
        snapshot.put("categorieTransport", reference("CategorieTransport", vehicule.getCategorieTransport(),
                vehicule.getCategorieTransport() == null ? null : joinReference(
                        vehicule.getCategorieTransport().getCode(),
                        vehicule.getCategorieTransport().getLibelle()
                )));
        snapshot.put("carburant", vehicule.getCarburant());
        snapshot.put("puissanceFiscale", vehicule.getPuissanceFiscale());
        snapshot.put("cylindree", vehicule.getCylindree());
        snapshot.put("nombrePlaces", vehicule.getNombrePlaces());
        snapshot.put("sousClasse", vehicule.getSousClasse());
        snapshot.put("ptc", vehicule.getPtc());
        snapshot.put("datePremiereCirculation", vehicule.getDatePremiereCirculation());
        snapshot.put("dateEffet", vehicule.getDateEffet());
        snapshot.put("dateEcheance", vehicule.getDateEcheance());
        snapshot.put("crm", vehicule.getCrm());
        snapshot.put("numeroAttestation", vehicule.getNumeroAttestation());
        snapshot.put("valeurVenale", vehicule.getValeurVenale());
        snapshot.put("valeurNeuf", vehicule.getValeurNeuf());
        snapshot.put("valeurGlace", vehicule.getValeurGlace());
        recordOperationSnapshot(agenceId, "Vehicule", vehicule.getId(), created, snapshot);
    }

    @Transactional
    public void recordContractTrailerSaved(Long agenceId, Remorque remorque, boolean created) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("contrat", contractReference(remorque.getContrat()));
        snapshot.put("immatriculation", remorque.getImmatriculation());
        snapshot.put("usage", reference("Usage", remorque.getUsage(),
                remorque.getUsage() == null ? null : joinReference(remorque.getUsage().getCode(), remorque.getUsage().getLibelle())));
        snapshot.put("marque", reference("Marque", remorque.getMarque(),
                remorque.getMarque() == null ? null : remorque.getMarque().getLibelle()));
        snapshot.put("ptc", remorque.getPtc());
        snapshot.put("dateMiseEnCirculation", remorque.getDateMiseEnCirculation());
        snapshot.put("dateEffet", remorque.getDateEffet());
        snapshot.put("dateEcheance", remorque.getDateEcheance());
        snapshot.put("crm", remorque.getCrm());
        snapshot.put("numeroAttestation", remorque.getNumeroAttestation());
        snapshot.put("valeurAssuree", remorque.getValeurAssuree());
        recordOperationSnapshot(agenceId, "Remorque", remorque.getId(), created, snapshot);
    }

    private void recordOperationSnapshot(
            Long agenceId,
            String entityType,
            Long entityId,
            boolean created,
            Map<String, Object> snapshot
    ) {
        Long actorUserId = TenantContext.getCurrentUser();
        String source = AuditRequestContext.getSource();
        auditEventRepository.save(AuditEvent.operationSnapshot(
                agenceId,
                actorUserId,
                TenantContext.getCurrentUsername(),
                actorUserId == null
                        ? "IMPORT".equalsIgnoreCase(source) ? AuditActorType.IMPORT : AuditActorType.SYSTEM
                        : AuditActorType.USER,
                entityType,
                String.valueOf(entityId),
                created ? AuditAction.CREATED : AuditAction.UPDATED,
                toJson(snapshot),
                AuditRequestContext.getRequestId(),
                source,
                AuditRequestContext.getOperationCode()
        ));
    }

    private Map<String, Object> contractReference(Contrat contrat) {
        if (contrat == null) {
            return null;
        }
        return reference("Contrat", contrat, firstNotBlank(
                contrat.getNumeroPolice(),
                contrat.getNumeroDossier(),
                contrat.getNumeroContrat(),
                contrat.getNumeroDevis()
        ));
    }

    private Map<String, Object> reference(String type, BaseEntity entity, String label) {
        if (entity == null) {
            return null;
        }
        Map<String, Object> reference = new LinkedHashMap<>();
        reference.put("type", type);
        reference.put("id", entity.getId());
        if (StringUtils.hasText(label)) {
            reference.put("label", label);
        }
        return reference;
    }

    private String joinReference(String code, String label) {
        if (!StringUtils.hasText(code)) return label;
        if (!StringUtils.hasText(label) || code.equalsIgnoreCase(label)) return code;
        return code + " - " + label;
    }

    private String firstNotBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) return value;
        }
        return null;
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Impossible de sérialiser la trace d'audit", exception);
        }
    }

    @Transactional(readOnly = true)
    public PagedResponse<AuditEventResponse> search(
            Long agenceId,
            String entityType,
            String entityId,
            AuditAction action,
            Long actorUserId,
            LocalDateTime dateFrom,
            LocalDateTime dateTo,
            String search,
            int page,
            int size
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Page<AuditEvent> result = auditEventRepository.search(
                agenceId,
                normalize(entityType, false),
                normalize(entityId, false),
                action,
                actorUserId,
                dateFrom,
                dateTo,
                normalize(search, true),
                PageRequest.of(safePage, safeSize)
        );
        Map<Long, Utilisateur> actors = utilisateurRepository.findAllById(result.getContent().stream()
                        .map(AuditEvent::getActorUserId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Utilisateur::getId, Function.identity()));
        return PagedResponse.<AuditEventResponse>builder()
                .items(result.getContent().stream()
                        .map(event -> toResponse(event, actors.get(event.getActorUserId())))
                        .toList())
                .page(PageMetadata.from(result))
                .build();
    }

    @Transactional(readOnly = true)
    public PagedResponse<AuditOperationResponse> searchOperations(
            Long agenceId,
            String entityType,
            String entityId,
            AuditAction action,
            Long actorUserId,
            LocalDateTime dateFrom,
            LocalDateTime dateTo,
            String search,
            int page,
            int size
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Page<String> keys = auditEventRepository.searchOperationKeys(
                agenceId,
                normalize(entityType, false),
                normalize(entityId, false),
                action == null ? null : action.name(),
                actorUserId,
                dateFrom,
                dateTo,
                normalize(search, true),
                PageRequest.of(safePage, safeSize)
        );
        if (keys.isEmpty()) {
            return PagedResponse.<AuditOperationResponse>builder()
                    .items(List.of())
                    .page(PageMetadata.from(keys))
                    .build();
        }

        List<String> requestIds = keys.getContent().stream()
                .filter(key -> key.startsWith("request:"))
                .map(key -> key.substring("request:".length()))
                .toList();
        List<Long> eventIds = keys.getContent().stream()
                .filter(key -> key.startsWith("event:"))
                .map(key -> Long.parseLong(key.substring("event:".length())))
                .toList();
        List<AuditEvent> operationEvents = auditEventRepository.findAllForOperations(
                agenceId,
                requestIds.isEmpty() ? List.of("__none__") : requestIds,
                eventIds.isEmpty() ? List.of(-1L) : eventIds
        );
        Map<Long, Utilisateur> actors = loadActors(operationEvents);
        Map<String, List<AuditEventResponse>> eventsByKey = new LinkedHashMap<>();
        keys.getContent().forEach(key -> eventsByKey.put(key, new ArrayList<>()));
        operationEvents.forEach(event -> {
            String key = operationKey(event);
            List<AuditEventResponse> groupedEvents = eventsByKey.get(key);
            if (groupedEvents != null) {
                groupedEvents.add(toResponse(event, actors.get(event.getActorUserId())));
            }
        });

        return PagedResponse.<AuditOperationResponse>builder()
                .items(eventsByKey.entrySet().stream()
                        .map(entry -> AuditOperationResponse.builder()
                                .key(entry.getKey())
                                .events(entry.getValue())
                                .build())
                        .toList())
                .page(PageMetadata.from(keys))
                .build();
    }

    private Map<Long, Utilisateur> loadActors(List<AuditEvent> events) {
        return utilisateurRepository.findAllById(events.stream()
                        .map(AuditEvent::getActorUserId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Utilisateur::getId, Function.identity()));
    }

    private String operationKey(AuditEvent event) {
        return StringUtils.hasText(event.getRequestId())
                ? "request:" + event.getRequestId()
                : "event:" + event.getId();
    }

    private AuditEventResponse toResponse(AuditEvent event, Utilisateur actor) {
        String snapshot = event.getActorName();
        String actorName = actor == null ? snapshot : actor.getFullName();
        String actorEmail = actor == null && snapshot != null && snapshot.contains("@")
                ? snapshot
                : actor == null ? null : actor.getEmail();
        return AuditEventResponse.builder()
                .id(event.getId())
                .agenceId(event.getAgenceId())
                .actorUserId(event.getActorUserId())
                .actorName(actorName)
                .actorEmail(actorEmail)
                .actorType(event.getActorType())
                .entityType(event.getEntityType())
                .entityId(event.getEntityId())
                .action(event.getAction())
                .occurredAt(event.getOccurredAt())
                .beforeData(readJson(event.getBeforeData()))
                .afterData(readJson(event.getAfterData()))
                .requestId(event.getRequestId())
                .source(event.getSource())
                .operationCode(event.getOperationCode())
                .build();
    }

    private JsonNode readJson(String json) {
        if (!StringUtils.hasText(json)) {
            return null;
        }
        try {
            return objectMapper.readTree(json);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Trace d'audit JSON invalide", exception);
        }
    }

    private String contextJson(Agence agence) {
        try {
            return objectMapper.writeValueAsString(Map.of(
                    "mode", agence == null ? "PLATFORM" : "AGENCY",
                    "agenceId", agence == null ? "" : String.valueOf(agence.getId()),
                    "agenceCode", agence == null ? "" : agence.getCode(),
                    "agenceName", agence == null ? "" : agence.getNom()
            ));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Impossible de journaliser le changement de contexte agence", exception);
        }
    }

    private String normalize(String value, boolean lowercase) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String normalized = value.trim();
        return lowercase ? normalized.toLowerCase(Locale.ROOT) : normalized;
    }
}
