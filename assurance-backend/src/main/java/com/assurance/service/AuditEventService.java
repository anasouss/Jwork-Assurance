package com.assurance.service;

import com.assurance.dto.response.AuditEventResponse;
import com.assurance.dto.response.PageMetadata;
import com.assurance.dto.response.PagedResponse;
import com.assurance.entity.AuditEvent;
import com.assurance.entity.Agence;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.AuditAction;
import com.assurance.repository.AuditEventRepository;
import com.assurance.security.AuditRequestContext;
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
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuditEventService {

    private static final int MAX_PAGE_SIZE = 100;

    private final AuditEventRepository auditEventRepository;
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
                AuditRequestContext.getSource()
        ));
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
        return PagedResponse.<AuditEventResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .page(PageMetadata.from(result))
                .build();
    }

    private AuditEventResponse toResponse(AuditEvent event) {
        return AuditEventResponse.builder()
                .id(event.getId())
                .agenceId(event.getAgenceId())
                .actorUserId(event.getActorUserId())
                .actorName(event.getActorName())
                .actorType(event.getActorType())
                .entityType(event.getEntityType())
                .entityId(event.getEntityId())
                .action(event.getAction())
                .occurredAt(event.getOccurredAt())
                .beforeData(readJson(event.getBeforeData()))
                .afterData(readJson(event.getAfterData()))
                .requestId(event.getRequestId())
                .source(event.getSource())
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
