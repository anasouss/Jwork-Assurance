package com.assurance.service;

import com.assurance.dto.request.BulkUpdateTarifUsageRequest;
import com.assurance.dto.response.AjustementTarifUsageResponse;
import com.assurance.dto.response.PageMetadata;
import com.assurance.dto.response.PagedResponse;
import com.assurance.entity.AjustementTarifUsage;
import com.assurance.entity.LigneAjustementTarifUsage;
import com.assurance.entity.TarifUsage;
import com.assurance.enums.SensAjustementTarifUsage;
import com.assurance.enums.TypeCalculAjustementTarifUsage;
import com.assurance.enums.TypeOperationTarifUsage;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.AjustementTarifUsageRepository;
import com.assurance.repository.LigneAjustementTarifUsageRepository;
import com.assurance.repository.TarifUsageRepository;
import com.assurance.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TarifUsageAjustementService {

    private final TarifUsageRepository tarifUsageRepository;
    private final AjustementTarifUsageRepository ajustementRepository;
    private final LigneAjustementTarifUsageRepository ligneRepository;
    private final UtilisateurRepository utilisateurRepository;

    @Transactional
    public AjustementTarifUsageResponse apply(BulkUpdateTarifUsageRequest request) {
        validate(request);
        List<TarifUsage> targets = resolveTargets(request);
        if (targets.isEmpty()) {
            throw new BadRequestException("Aucun tarif actif ne correspond a la selection");
        }

        boolean adjustment = request.getTypeOperation() == TypeOperationTarifUsage.AJUSTEMENT;
        AjustementTarifUsage batch = ajustementRepository.save(AjustementTarifUsage.builder()
                .typeOperation(request.getTypeOperation())
                .typeCalcul(adjustment ? request.getTypeCalcul() : null)
                .sens(adjustment ? request.getSens() : null)
                .valeur(adjustment ? request.getValue() : null)
                .dateDebut(request.getDateDebut())
                .dateFin(request.getDateFin())
                .motif(normalizeMotif(request.getMotif(), request.getTypeOperation()))
                .build());
        List<LigneAjustementTarifUsage> lines = targets.stream()
                .map(tarif -> createLine(batch, tarif, request))
                .toList();
        ligneRepository.saveAll(lines);
        return toResponse(batch, lines, null);
    }

    @Transactional(readOnly = true)
    public PagedResponse<AjustementTarifUsageResponse> history(int page, int size) {
        Page<AjustementTarifUsage> result = ajustementRepository.findAllByOrderByCreatedAtDescIdDesc(
                PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size)))
        );
        Map<Long, String> users = userNames(result.getContent());
        List<AjustementTarifUsageResponse> items = result.getContent().stream()
                .map(batch -> toResponse(
                        batch,
                        ligneRepository.findByAjustementIdOrderByTarifUsageIdAsc(batch.getId()),
                        users.get(batch.getCreatedByUserId())
                ))
                .toList();
        return PagedResponse.<AjustementTarifUsageResponse>builder()
                .items(items)
                .page(PageMetadata.from(result))
                .build();
    }

    @Transactional(readOnly = true)
    public BigDecimal resolvePrimeNette(TarifUsage tarif, LocalDate referenceDate) {
        if (tarif == null || tarif.getId() == null) {
            return tarif == null ? null : tarif.getPrimeNette();
        }
        LocalDate reference = referenceDate == null ? LocalDate.now() : referenceDate;
        return ligneRepository.findApplicable(tarif.getId(), reference, PageRequest.of(0, 1)).stream()
                .map(LigneAjustementTarifUsage::getPrimeNetteAppliquee)
                .findFirst()
                .orElse(tarif.getPrimeNette());
    }

    @Transactional(readOnly = true)
    public Map<Long, BigDecimal> resolvePrimeNettes(Collection<TarifUsage> tarifs, LocalDate referenceDate) {
        if (tarifs == null || tarifs.isEmpty()) {
            return Map.of();
        }
        Map<Long, BigDecimal> result = new LinkedHashMap<>();
        tarifs.stream()
                .filter(tarif -> tarif.getId() != null)
                .forEach(tarif -> result.put(tarif.getId(), tarif.getPrimeNette()));
        if (result.isEmpty()) {
            return result;
        }
        Set<Long> adjusted = new HashSet<>();
        ligneRepository.findApplicable(
                result.keySet(),
                referenceDate == null ? LocalDate.now() : referenceDate
        ).forEach(line -> {
            Long tarifId = line.getTarifUsage().getId();
            if (adjusted.add(tarifId)) {
                result.put(tarifId, line.getPrimeNetteAppliquee());
            }
        });
        return result;
    }

    @Transactional(readOnly = true)
    public boolean hasHistory(Long tarifUsageId) {
        return tarifUsageId != null && ligneRepository.existsByTarifUsageId(tarifUsageId);
    }

    private void validate(BulkUpdateTarifUsageRequest request) {
        if (request.getDateFin() != null && request.getDateFin().isBefore(request.getDateDebut())) {
            throw new BadRequestException("La date de fin doit etre posterieure ou egale a la date de debut");
        }
        if (request.getTypeOperation() == TypeOperationTarifUsage.AJUSTEMENT
                && (request.getTypeCalcul() == null || request.getSens() == null
                || request.getValue() == null || request.getValue().signum() <= 0)) {
            throw new BadRequestException("Le type, le sens et une valeur positive sont obligatoires");
        }
    }

    private List<TarifUsage> resolveTargets(BulkUpdateTarifUsageRequest request) {
        Set<Long> tarifIds = new HashSet<>(request.getTarifIds() == null ? List.of() : request.getTarifIds());
        Set<Long> usageIds = new HashSet<>(request.getUsageIds() == null ? List.of() : request.getUsageIds());
        return tarifUsageRepository.findAll().stream()
                .filter(tarif -> Boolean.TRUE.equals(tarif.getActif()))
                .filter(tarif -> tarifIds.isEmpty() || tarifIds.contains(tarif.getId()))
                .filter(tarif -> !tarifIds.isEmpty()
                        || usageIds.isEmpty()
                        || (tarif.getUsage() != null && usageIds.contains(tarif.getUsage().getId())))
                .toList();
    }

    private LigneAjustementTarifUsage createLine(
            AjustementTarifUsage batch,
            TarifUsage tarif,
            BulkUpdateTarifUsageRequest request
    ) {
        BigDecimal initial = money(tarif.getPrimeNette());
        BigDecimal applied = request.getTypeOperation() == TypeOperationTarifUsage.REINITIALISATION
                ? initial
                : adjust(initial, request.getTypeCalcul(), request.getSens(), request.getValue());
        return LigneAjustementTarifUsage.builder()
                .ajustement(batch)
                .tarifUsage(tarif)
                .primeNetteInitiale(initial)
                .primeNetteAppliquee(applied)
                .usageCodeSnapshot(tarif.getUsage() == null ? null : tarif.getUsage().getCode())
                .descriptionSnapshot(describe(tarif))
                .build();
    }

    private BigDecimal adjust(
            BigDecimal initial,
            TypeCalculAjustementTarifUsage type,
            SensAjustementTarifUsage direction,
            BigDecimal value
    ) {
        BigDecimal adjusted;
        if (type == TypeCalculAjustementTarifUsage.POURCENTAGE) {
            BigDecimal factor = value.divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
            adjusted = direction == SensAjustementTarifUsage.BAISSE
                    ? initial.multiply(BigDecimal.ONE.subtract(factor))
                    : initial.multiply(BigDecimal.ONE.add(factor));
        } else {
            adjusted = direction == SensAjustementTarifUsage.BAISSE
                    ? initial.subtract(value)
                    : initial.add(value);
        }
        return money(adjusted.max(BigDecimal.ZERO));
    }

    private AjustementTarifUsageResponse toResponse(
            AjustementTarifUsage batch,
            List<LigneAjustementTarifUsage> lines,
            String userName
    ) {
        return AjustementTarifUsageResponse.builder()
                .id(batch.getId())
                .typeOperation(batch.getTypeOperation())
                .typeCalcul(batch.getTypeCalcul())
                .sens(batch.getSens())
                .valeur(batch.getValeur())
                .dateDebut(batch.getDateDebut())
                .dateFin(batch.getDateFin())
                .motif(batch.getMotif())
                .createdByUserId(batch.getCreatedByUserId())
                .createdByName(userName)
                .createdAt(batch.getCreatedAt())
                .nombreTarifs(lines.size())
                .lignes(lines.stream().map(this::toLineResponse).toList())
                .build();
    }

    private AjustementTarifUsageResponse.Ligne toLineResponse(LigneAjustementTarifUsage line) {
        TarifUsage tarif = line.getTarifUsage();
        return AjustementTarifUsageResponse.Ligne.builder()
                .tarifUsageId(tarif.getId())
                .usageCode(line.getUsageCodeSnapshot())
                .description(line.getDescriptionSnapshot())
                .primeNetteInitiale(line.getPrimeNetteInitiale())
                .primeNetteAppliquee(line.getPrimeNetteAppliquee())
                .build();
    }

    private String describe(TarifUsage tarif) {
        return List.of(
                        text(tarif.getCategorieTransport() == null ? null : tarif.getCategorieTransport().getLibelle()),
                        text(tarif.getCarburant() == null ? null : tarif.getCarburant().getLibelle()),
                        text(tarif.getSousClasse() == null ? null : tarif.getSousClasse().getCode()),
                        range("PF", tarif.getPuissanceFiscaleMin(), tarif.getPuissanceFiscaleMax()),
                        range("Places", tarif.getNombrePlacesMin(), tarif.getNombrePlacesMax()),
                        range("PTC", tarif.getPtcMin(), tarif.getPtcMax())
                ).stream()
                .filter(value -> !value.isBlank())
                .collect(Collectors.joining(" · "));
    }

    private Map<Long, String> userNames(List<AjustementTarifUsage> adjustments) {
        Set<Long> ids = adjustments.stream()
                .map(AjustementTarifUsage::getCreatedByUserId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, String> result = new HashMap<>();
        utilisateurRepository.findAllById(ids).forEach(user -> result.put(user.getId(), user.getFullName()));
        return result;
    }

    private String normalizeMotif(String motif, TypeOperationTarifUsage operation) {
        String normalized = motif == null ? "" : motif.trim();
        if (!normalized.isEmpty()) {
            return normalized;
        }
        return operation == TypeOperationTarifUsage.REINITIALISATION
                ? "Reinitialisation au tarif initial"
                : "Ajustement tarifaire";
    }

    private String range(String label, BigDecimal min, BigDecimal max) {
        if (min == null && max == null) {
            return "";
        }
        return label + " " + text(min) + "/" + text(max);
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }
}
