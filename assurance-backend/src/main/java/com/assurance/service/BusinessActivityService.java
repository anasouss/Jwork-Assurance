package com.assurance.service;

import com.assurance.activity.ActivityAction;
import com.assurance.activity.ActivityChange;
import com.assurance.activity.ActivityModule;
import com.assurance.activity.ActivityRecordType;
import com.assurance.activity.ActivityReference;
import com.assurance.dto.response.BusinessActivityResponse;
import com.assurance.dto.response.PageMetadata;
import com.assurance.dto.response.PagedResponse;
import com.assurance.entity.BusinessActivity;
import com.assurance.repository.BusinessActivityRepository;
import com.assurance.repository.BusinessActivitySummary;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.security.TenantContext;
import com.assurance.security.UserPrincipal;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class BusinessActivityService {
    private final BusinessActivityRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public PagedResponse<BusinessActivityResponse> search(
            ActivityModule module, ActivityAction action, ActivityRecordType subjectType,
            String subjectId, Long actorUserId, LocalDateTime dateFrom, LocalDateTime dateTo,
            String search, int page, int size) {
        assertAdministrator();
        Long agencyId = TenantContext.getCurrentAgence();
        var result = repository.searchSummaries((root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (agencyId != null) predicates.add(cb.equal(root.get("agence").get("id"), agencyId));
            if (module != null) predicates.add(cb.equal(root.get("module"), module));
            if (action != null) predicates.add(cb.equal(root.get("action"), action));
            if (subjectType != null) predicates.add(cb.equal(root.get("subjectType"), subjectType));
            if (subjectId != null && !subjectId.isBlank()) predicates.add(cb.equal(root.get("subjectId"), subjectId.trim()));
            if (actorUserId != null) predicates.add(cb.equal(root.get("actor").get("id"), actorUserId));
            if (dateFrom != null) predicates.add(cb.greaterThanOrEqualTo(root.get("occurredAt"), dateFrom));
            if (dateTo != null) predicates.add(cb.lessThanOrEqualTo(root.get("occurredAt"), dateTo));
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase(Locale.ROOT)
                        .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("title")), pattern, '\\'),
                        cb.like(cb.lower(root.get("subjectLabel")), pattern, '\\'),
                        cb.like(cb.lower(root.get("actorName")), pattern, '\\'),
                        cb.like(cb.lower(root.get("referencesJson")), pattern, '\\')));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        }, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Order.desc("occurredAt"), Sort.Order.desc("id"))));
        return PagedResponse.<BusinessActivityResponse>builder()
                .items(result.getContent().stream().map(this::response).toList())
                .page(PageMetadata.from(result)).build();
    }

    @Transactional(readOnly = true)
    public BusinessActivityResponse detail(Long id) {
        assertAdministrator();
        Long agencyId = TenantContext.getCurrentAgence();
        BusinessActivity event = (agencyId == null ? repository.findById(id) : repository.findByIdAndAgenceId(id, agencyId))
                .orElseThrow(() -> new ResourceNotFoundException("Activite metier", id));
        return response(event);
    }

    private void assertAdministrator() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || !(authentication.getPrincipal() instanceof UserPrincipal user)
                || !user.getPermissions().contains("activity:view")
                || !("AGENCY_ADMIN".equals(user.getRoleCode()) || "SUPER_ADMIN".equals(user.getRoleCode()))) {
            throw new AccessDeniedException("Historique metier reserve aux administrateurs");
        }
        if (TenantContext.getCurrentAgence() == null
                && !(user.getAgenceId() == null && "SUPER_ADMIN".equals(user.getRoleCode()))) {
            throw new AccessDeniedException("Contexte d'agence obligatoire");
        }
        if (user.getAgenceId() != null && !Objects.equals(user.getAgenceId(), TenantContext.getCurrentAgence())) {
            throw new AccessDeniedException("Historique hors du perimetre de l'agence");
        }
    }

    private BusinessActivityResponse response(BusinessActivity event) {
        try {
            return new BusinessActivityResponse(event.getId(),
                    event.getAgence() == null ? null : event.getAgence().getId(),
                    event.getActor() == null ? null : event.getActor().getId(),
                    event.getActorName(), event.getOccurredAt(), event.getModule(), event.getAction(),
                    event.getTitle(), event.getOrigin(), event.getSurface(), event.getSurface().getLabel(),
                    new ActivityReference(event.getSubjectType(), event.getSubjectId(), event.getSubjectLabel()),
                    objectMapper.readValue(event.getReferencesJson(), new TypeReference<List<ActivityReference>>() {}),
                    objectMapper.readValue(event.getChangesJson(), new TypeReference<List<ActivityChange>>() {}));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Activite metier illisible", exception);
        }
    }

    private BusinessActivityResponse response(BusinessActivitySummary event) {
        try {
            return new BusinessActivityResponse(event.id(), event.agenceId(), event.actorUserId(), event.actorName(),
                    event.occurredAt(), event.module(), event.action(), event.title(), event.origin(),
                    event.surface(), event.surface().getLabel(),
                    new ActivityReference(event.subjectType(), event.subjectId(), event.subjectLabel()),
                    objectMapper.readValue(event.referencesJson(), new TypeReference<List<ActivityReference>>() {}), List.of());
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Activite metier illisible", exception);
        }
    }
}
