package com.assurance.service;

import com.assurance.dto.request.UpsertRegleFiscaleRequest;
import com.assurance.dto.response.RegleFiscaleResponse;
import com.assurance.entity.RegleFiscale;
import com.assurance.enums.BaseCalculRegleFiscale;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.ModeCalculRegleFiscale;
import com.assurance.enums.NatureRegleFiscale;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ApplicationRegleFiscaleQuittanceRepository;
import com.assurance.repository.CategorieClientRepository;
import com.assurance.repository.CompagnieAssuranceRepository;
import com.assurance.repository.GarantieRepository;
import com.assurance.repository.GroupeUsageAttestationRepository;
import com.assurance.repository.RegleFiscaleRepository;
import com.assurance.repository.UsageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class RegleFiscaleService {

    private final RegleFiscaleRepository regleFiscaleRepository;
    private final ApplicationRegleFiscaleQuittanceRepository applicationRepository;
    private final CompagnieAssuranceRepository compagnieAssuranceRepository;
    private final CategorieClientRepository categorieClientRepository;
    private final GarantieRepository garantieRepository;
    private final UsageRepository usageRepository;
    private final GroupeUsageAttestationRepository groupeUsageAttestationRepository;

    @Transactional(readOnly = true)
    public List<RegleFiscaleResponse> list() {
        return regleFiscaleRepository.findAll().stream()
                .sorted(Comparator.comparing(RegleFiscale::getDateDebut).reversed()
                        .thenComparing(RegleFiscale::getNature)
                        .thenComparing(RegleFiscale::getCode))
                .map(RegleFiscaleResponse::from)
                .toList();
    }

    @Transactional
    public RegleFiscaleResponse create(UpsertRegleFiscaleRequest request) {
        RegleFiscale rule = new RegleFiscale();
        apply(rule, request);
        validateNoOverlap(rule);
        return RegleFiscaleResponse.from(regleFiscaleRepository.save(rule));
    }

    @Transactional
    public RegleFiscaleResponse update(Long id, UpsertRegleFiscaleRequest request) {
        RegleFiscale rule = get(id);
        if (applicationRepository.existsByRegleFiscaleId(id) && changesCalculation(rule, request)) {
            throw new BadRequestException("Cette règle a déjà été appliquée. Clôturez sa période et créez une nouvelle version.");
        }
        applicationRepository.findLatestApplicationDate(id).ifPresent(latestDate -> {
            if (request.getDateFin() != null && !request.getDateFin().isAfter(latestDate)) {
                throw new BadRequestException(
                        "La date de fin doit être postérieure à la dernière quittance ayant appliqué cette règle ("
                                + latestDate + ")");
            }
        });
        apply(rule, request);
        validateNoOverlap(rule);
        return RegleFiscaleResponse.from(regleFiscaleRepository.save(rule));
    }

    @Transactional
    public void deactivate(Long id) {
        RegleFiscale rule = get(id);
        rule.setActif(false);
        regleFiscaleRepository.save(rule);
    }

    private RegleFiscale get(Long id) {
        return regleFiscaleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("RegleFiscale", id));
    }

    private void apply(RegleFiscale rule, UpsertRegleFiscaleRequest request) {
        validateRequest(request);
        rule.setCode(request.getCode().trim().toUpperCase(Locale.ROOT));
        rule.setLibelle(request.getLibelle().trim());
        rule.setNature(request.getNature());
        rule.setModeCalcul(request.getModeCalcul());
        rule.setValeur(request.getValeur());
        rule.setBaseCalcul(request.getBaseCalcul());
        rule.setCategorieBase(request.getCategorieBase());
        rule.setCategorieResultat(request.getCategorieResultat());
        rule.setCompagnieAssurance(request.getCompagnieAssuranceId() == null ? null
                : compagnieAssuranceRepository.findById(request.getCompagnieAssuranceId())
                .orElseThrow(() -> new ResourceNotFoundException("CompagnieAssurance", request.getCompagnieAssuranceId())));
        rule.setCategorieClient(request.getCategorieClientId() == null ? null
                : categorieClientRepository.findById(request.getCategorieClientId())
                .orElseThrow(() -> new ResourceNotFoundException("CategorieClient", request.getCategorieClientId())));
        rule.setGarantie(request.getGarantieId() == null ? null
                : garantieRepository.findById(request.getGarantieId())
                .orElseThrow(() -> new ResourceNotFoundException("Garantie", request.getGarantieId())));
        rule.setTypeGarantie(request.getTypeGarantie());
        rule.setUsage(request.getUsageId() == null ? null
                : usageRepository.findById(request.getUsageId())
                .orElseThrow(() -> new ResourceNotFoundException("Usage", request.getUsageId())));
        rule.setGroupeUsageAttestation(request.getGroupeUsageAttestationId() == null ? null
                : groupeUsageAttestationRepository.findById(request.getGroupeUsageAttestationId())
                .orElseThrow(() -> new ResourceNotFoundException("GroupeUsageAttestation", request.getGroupeUsageAttestationId())));
        rule.setTypeContrat(request.getTypeContrat());
        rule.setDateDebut(request.getDateDebut());
        rule.setDateFin(request.getDateFin());
        rule.setApplicable(request.getApplicable() == null || request.getApplicable());
        rule.setPriorite(request.getPriorite() == null ? 0 : request.getPriorite());
        rule.setActif(request.getActif() == null || request.getActif());
        rule.setDescription(blankToNull(request.getDescription()));
        rule.setReferenceReglementaire(blankToNull(request.getReferenceReglementaire()));
    }

    private void validateRequest(UpsertRegleFiscaleRequest request) {
        if (request.getDateFin() != null && !request.getDateFin().isAfter(request.getDateDebut())) {
            throw new BadRequestException("La date de fin doit être postérieure à la date de début");
        }
        if (request.getCategorieResultat() == CategorieQuittance.TOTAL
                || request.getCategorieBase() == CategorieQuittance.TOTAL) {
            throw new BadRequestException("La catégorie TOTAL est calculée automatiquement et ne peut pas porter une règle");
        }
        if (request.getCategorieResultat() == CategorieQuittance.ASSISTANCE
                || request.getCategorieBase() == CategorieQuittance.ASSISTANCE) {
            throw new BadRequestException(
                    "Les taxes d'assistance sont définies par les tarifs d'assistance HT/TTC");
        }
        if (request.getModeCalcul() == ModeCalculRegleFiscale.TAUX
                && request.getValeur().compareTo(BigDecimal.ONE) > 0) {
            throw new BadRequestException("Un taux doit être saisi sous forme décimale entre 0 et 1");
        }
        if (request.getBaseCalcul() == BaseCalculRegleFiscale.PRIME_CATEGORIE
                && request.getCategorieBase() == null) {
            throw new BadRequestException("La catégorie de base est obligatoire pour une règle calculée sur une catégorie");
        }
        if (request.getBaseCalcul() == BaseCalculRegleFiscale.PRIME_CATEGORIE
                && request.getCategorieBase() != request.getCategorieResultat()) {
            throw new BadRequestException("Une règle calculée sur une catégorie doit produire son résultat dans la même catégorie");
        }
        if (request.getBaseCalcul() == BaseCalculRegleFiscale.PRIME_GARANTIE
                && request.getCategorieBase() != null) {
            throw new BadRequestException("Une règle calculée par garantie ne doit pas définir de catégorie de base");
        }
        if (request.getBaseCalcul() != BaseCalculRegleFiscale.PRIME_GARANTIE
                && (request.getGarantieId() != null || request.getTypeGarantie() != null
                || request.getUsageId() != null || request.getGroupeUsageAttestationId() != null)) {
            throw new BadRequestException("Les périmètres garantie et usage ne s'appliquent qu'aux règles calculées par garantie");
        }
        if (request.getGarantieId() != null && request.getTypeGarantie() != null) {
            throw new BadRequestException("Choisissez une garantie précise ou un type de garantie, pas les deux");
        }
        if (request.getNature() == NatureRegleFiscale.CNPAC
                && (request.getBaseCalcul() != BaseCalculRegleFiscale.UNITE_ASSUREE
                || request.getModeCalcul() != ModeCalculRegleFiscale.MONTANT_FIXE)) {
            throw new BadRequestException("La CNPAC doit être un montant fixe calculé par unité assurée");
        }
        if (request.getNature() == NatureRegleFiscale.CNPAC
                && request.getCategorieResultat() != CategorieQuittance.AUTOMOBILE) {
            throw new BadRequestException("La CNPAC doit être portée par la catégorie automobile");
        }
        if (request.getNature() != NatureRegleFiscale.CNPAC
                && request.getBaseCalcul() == BaseCalculRegleFiscale.UNITE_ASSUREE) {
            throw new BadRequestException("Seule la CNPAC peut être calculée par unité assurée");
        }
        if (request.getNature() == NatureRegleFiscale.TPF
                && request.getBaseCalcul() != BaseCalculRegleFiscale.PRIME_CATEGORIE) {
            throw new BadRequestException("La TPF doit être calculée sur une catégorie de quittance");
        }
        if (request.getNature() == NatureRegleFiscale.TAXE_ASSURANCE
                && request.getBaseCalcul() == BaseCalculRegleFiscale.PRIME_CATEGORIE
                && request.getCategorieBase() != CategorieQuittance.EVCAT) {
            throw new BadRequestException(
                    "Une taxe d'assurance par catégorie est réservée à la catégorie EVCAT");
        }
        if (request.getNature() == NatureRegleFiscale.EVCAT
                && request.getBaseCalcul() != BaseCalculRegleFiscale.PRIME_GARANTIE) {
            throw new BadRequestException("L'EVCAT doit être calculée à partir d'une prime de garantie");
        }
        if (request.getNature() == NatureRegleFiscale.EVCAT
                && request.getCategorieResultat() != CategorieQuittance.EVCAT) {
            throw new BadRequestException("Une règle EVCAT doit produire son résultat dans la catégorie EVCAT");
        }
    }

    private void validateNoOverlap(RegleFiscale candidate) {
        boolean duplicateCodeDate = regleFiscaleRepository
                .findByCodeIgnoreCaseAndDateDebut(candidate.getCode(), candidate.getDateDebut())
                .filter(existing -> !Objects.equals(existing.getId(), candidate.getId()))
                .isPresent();
        if (duplicateCodeDate) {
            throw new BadRequestException("Une version de cette règle existe déjà à cette date");
        }
        boolean overlap = regleFiscaleRepository.findAll().stream()
                .filter(existing -> !Objects.equals(existing.getId(), candidate.getId()))
                .filter(existing -> Boolean.TRUE.equals(existing.getActif()) && Boolean.TRUE.equals(candidate.getActif()))
                .filter(existing -> sameScope(existing, candidate))
                .anyMatch(existing -> periodsOverlap(existing, candidate));
        if (overlap) {
            throw new BadRequestException("La période chevauche une règle active ayant exactement le même périmètre");
        }
    }

    private boolean sameScope(RegleFiscale left, RegleFiscale right) {
        return left.getNature() == right.getNature()
                && left.getBaseCalcul() == right.getBaseCalcul()
                && left.getCategorieBase() == right.getCategorieBase()
                && Objects.equals(id(left.getCompagnieAssurance()), id(right.getCompagnieAssurance()))
                && Objects.equals(id(left.getCategorieClient()), id(right.getCategorieClient()))
                && Objects.equals(id(left.getGarantie()), id(right.getGarantie()))
                && left.getTypeGarantie() == right.getTypeGarantie()
                && Objects.equals(id(left.getUsage()), id(right.getUsage()))
                && Objects.equals(id(left.getGroupeUsageAttestation()), id(right.getGroupeUsageAttestation()))
                && left.getTypeContrat() == right.getTypeContrat();
    }

    private boolean periodsOverlap(RegleFiscale left, RegleFiscale right) {
        boolean leftBeforeRightEnd = right.getDateFin() == null || left.getDateDebut().isBefore(right.getDateFin());
        boolean rightBeforeLeftEnd = left.getDateFin() == null || right.getDateDebut().isBefore(left.getDateFin());
        return leftBeforeRightEnd && rightBeforeLeftEnd;
    }

    private boolean changesCalculation(RegleFiscale rule, UpsertRegleFiscaleRequest request) {
        return !rule.getCode().equalsIgnoreCase(request.getCode().trim())
                || rule.getNature() != request.getNature()
                || rule.getModeCalcul() != request.getModeCalcul()
                || rule.getValeur().compareTo(request.getValeur()) != 0
                || rule.getBaseCalcul() != request.getBaseCalcul()
                || rule.getCategorieBase() != request.getCategorieBase()
                || rule.getCategorieResultat() != request.getCategorieResultat()
                || !Objects.equals(id(rule.getCompagnieAssurance()), request.getCompagnieAssuranceId())
                || !Objects.equals(id(rule.getCategorieClient()), request.getCategorieClientId())
                || !Objects.equals(id(rule.getGarantie()), request.getGarantieId())
                || rule.getTypeGarantie() != request.getTypeGarantie()
                || !Objects.equals(id(rule.getUsage()), request.getUsageId())
                || !Objects.equals(id(rule.getGroupeUsageAttestation()), request.getGroupeUsageAttestationId())
                || rule.getTypeContrat() != request.getTypeContrat()
                || !rule.getDateDebut().equals(request.getDateDebut())
                || !Objects.equals(rule.getApplicable(), request.getApplicable() == null || request.getApplicable())
                || !Objects.equals(rule.getPriorite(), request.getPriorite() == null ? 0 : request.getPriorite());
    }

    private Long id(Object entity) {
        return entity instanceof com.assurance.entity.BaseEntity base ? base.getId() : null;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
