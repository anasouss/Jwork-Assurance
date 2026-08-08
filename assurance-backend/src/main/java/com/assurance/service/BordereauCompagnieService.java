package com.assurance.service;

import com.assurance.dto.request.AnnulerBordereauCompagnieRequest;
import com.assurance.dto.request.CreerBordereauCompagnieRequest;
import com.assurance.dto.request.ModifierBordereauCompagnieRequest;
import com.assurance.dto.request.RapprocherBordereauCompagnieRequest;
import com.assurance.dto.request.TransmettreBordereauCompagnieRequest;
import com.assurance.dto.response.BordereauCompagniePageResponse;
import com.assurance.dto.response.BordereauCompagnieResponse;
import com.assurance.dto.response.SourceBordereauCompagnieResponse;
import com.assurance.dto.response.SourceDocumentClientPageResponse;
import com.assurance.entity.AffectationQuittanceCompagnie;
import com.assurance.entity.AffectationReglementCompagnie;
import com.assurance.entity.Agence;
import com.assurance.entity.BordereauCompagnie;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.LigneBordereauCompagnie;
import com.assurance.entity.SequenceBordereauCompagnie;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.BaseBordereauCompagnie;
import com.assurance.enums.StatutAffectationReglement;
import com.assurance.enums.StatutBordereauCompagnie;
import com.assurance.enums.StatutRapprochementCompagnie;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.exception.UnauthorizedException;
import com.assurance.repository.AffectationQuittanceCompagnieRepository;
import com.assurance.repository.AffectationReglementCompagnieRepository;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.BordereauCompagnieRepository;
import com.assurance.repository.CompagnieAssuranceRepository;
import com.assurance.repository.LigneBordereauCompagnieRepository;
import com.assurance.repository.SequenceBordereauCompagnieRepository;
import com.assurance.repository.UtilisateurRepository;
import com.assurance.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class BordereauCompagnieService {

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final BordereauCompagnieRepository bordereauRepository;
    private final LigneBordereauCompagnieRepository ligneRepository;
    private final AffectationQuittanceCompagnieRepository sourceRepository;
    private final AffectationReglementCompagnieRepository allocationRepository;
    private final SequenceBordereauCompagnieRepository sequenceRepository;
    private final AgenceRepository agenceRepository;
    private final CompagnieAssuranceRepository compagnieRepository;
    private final UtilisateurRepository utilisateurRepository;

    @Transactional(readOnly = true)
    public List<SourceBordereauCompagnieResponse> eligibleSources(
            Long agenceId,
            Long compagnieId,
            BaseBordereauCompagnie base,
            LocalDate dateDu,
            LocalDate dateAu,
            String search
    ) {
        validatePeriod(dateDu, dateAu);
        String normalizedSearch = normalizeSearch(search);
        return sourceRepository.findEligible(agenceId, compagnieId, dateDu, dateAu).stream()
                .filter(source -> base != BaseBordereauCompagnie.ENCAISSEMENT
                        || Boolean.TRUE.equals(source.getQuittance().getPayee()))
                .filter(source -> matches(source, normalizedSearch))
                .map(this::toSourceResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public BordereauCompagniePageResponse search(
            Long agenceId,
            Long compagnieId,
            StatutBordereauCompagnie statut,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            int page,
            int size
    ) {
        validatePeriod(dateDu, dateAu);
        Page<BordereauCompagnie> result = bordereauRepository.search(
                agenceId,
                compagnieId,
                statut,
                dateDu,
                dateAu,
                normalizeSearch(search),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100))
        );
        Map<Long, AllocationAmounts> amounts = loadAllocationAmounts(
                result.getContent().stream().map(BordereauCompagnie::getId).toList()
        );
        List<BordereauCompagnieResponse> rows = result.getContent().stream()
                .map(bordereau -> toResponse(
                        bordereau,
                        amounts.getOrDefault(bordereau.getId(), AllocationAmounts.empty()),
                        false
                ))
                .toList();
        return BordereauCompagniePageResponse.builder()
                .summary(BordereauCompagniePageResponse.Resume.builder()
                        .total(result.getTotalElements())
                        .netCompagnie(sum(rows, BordereauCompagnieResponse::getNetCompagnie))
                        .montantRegle(sum(rows, BordereauCompagnieResponse::getMontantRegle))
                        .soldeRestant(sum(rows, BordereauCompagnieResponse::getSoldeRestant))
                        .build())
                .page(SourceDocumentClientPageResponse.PageInfo.builder()
                        .number(result.getNumber())
                        .size(result.getSize())
                        .totalElements(result.getTotalElements())
                        .totalPages(result.getTotalPages())
                        .first(result.isFirst())
                        .last(result.isLast())
                        .build())
                .rows(rows)
                .build();
    }

    @Transactional(readOnly = true)
    public BordereauCompagnieResponse get(Long agenceId, Long id) {
        BordereauCompagnie bordereau = bordereauRepository.findByIdAndAgenceId(id, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Bordereau compagnie", id));
        AllocationAmounts amounts = loadAllocationAmounts(List.of(id))
                .getOrDefault(id, AllocationAmounts.empty());
        return toResponse(bordereau, amounts, true);
    }

    @Transactional
    public BordereauCompagnieResponse create(
            Long agenceId,
            CreerBordereauCompagnieRequest request
    ) {
        validatePeriod(request.getPeriodeDebut(), request.getPeriodeFin());
        Agence agence = agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        CompagnieAssurance compagnie = findActiveCompany(request.getCompagnieId());
        Utilisateur actor = currentUser();
        BordereauCompagnie bordereau = BordereauCompagnie.builder()
                .agence(agence)
                .compagnieAssurance(compagnie)
                .numero(nextNumber(agence, request.getPeriodeFin().getYear()))
                .baseBordereau(request.getBaseBordereau())
                .statut(StatutBordereauCompagnie.BROUILLON)
                .statutRapprochement(StatutRapprochementCompagnie.A_RAPPROCHER)
                .periodeDebut(request.getPeriodeDebut())
                .periodeFin(request.getPeriodeFin())
                .notes(trimToNull(request.getNotes()))
                .creePar(actor)
                .build();
        replaceLines(bordereau, request.getAffectationIds());
        return toResponse(
                bordereauRepository.saveAndFlush(bordereau),
                AllocationAmounts.empty(),
                true
        );
    }

    @Transactional
    public BordereauCompagnieResponse update(
            Long agenceId,
            Long id,
            ModifierBordereauCompagnieRequest request
    ) {
        validatePeriod(request.getPeriodeDebut(), request.getPeriodeFin());
        BordereauCompagnie bordereau = lock(agenceId, id);
        requireDraft(bordereau);
        releaseReservations(bordereau);
        bordereau.getLignes().clear();
        bordereauRepository.flush();
        bordereau.setPeriodeDebut(request.getPeriodeDebut());
        bordereau.setPeriodeFin(request.getPeriodeFin());
        bordereau.setNotes(trimToNull(request.getNotes()));
        replaceLines(bordereau, request.getAffectationIds());
        return toResponse(
                bordereauRepository.saveAndFlush(bordereau),
                AllocationAmounts.empty(),
                true
        );
    }

    @Transactional
    public BordereauCompagnieResponse validate(Long agenceId, Long id) {
        BordereauCompagnie bordereau = lock(agenceId, id);
        requireDraft(bordereau);
        if (bordereau.getLignes().isEmpty()) {
            throw new BadRequestException("Le bordereau doit contenir au moins une ligne");
        }
        calculateTotals(bordereau);
        bordereau.setStatut(StatutBordereauCompagnie.VALIDE);
        bordereau.setDateValidation(LocalDateTime.now());
        bordereau.setValidePar(currentUser());
        return toResponse(
                bordereauRepository.saveAndFlush(bordereau),
                AllocationAmounts.empty(),
                true
        );
    }

    @Transactional
    public BordereauCompagnieResponse transmit(
            Long agenceId,
            Long id,
            TransmettreBordereauCompagnieRequest request
    ) {
        BordereauCompagnie bordereau = lock(agenceId, id);
        if (bordereau.getStatut() != StatutBordereauCompagnie.VALIDE) {
            throw new BadRequestException("Seul un bordereau validé peut être transmis");
        }
        if (request.getDateTransmission().isBefore(bordereau.getPeriodeFin())) {
            throw new BadRequestException("La transmission ne peut pas précéder la fin de période");
        }
        bordereau.setStatut(StatutBordereauCompagnie.TRANSMIS);
        bordereau.setDateTransmission(request.getDateTransmission());
        bordereau.setCanalTransmission(request.getCanalTransmission().trim());
        bordereau.setReferenceTransmission(trimToNull(request.getReferenceTransmission()));
        return toResponse(
                bordereauRepository.saveAndFlush(bordereau),
                loadAllocationAmounts(List.of(id)).getOrDefault(id, AllocationAmounts.empty()),
                true
        );
    }

    @Transactional
    public BordereauCompagnieResponse reconcile(
            Long agenceId,
            Long id,
            RapprocherBordereauCompagnieRequest request
    ) {
        BordereauCompagnie bordereau = lock(agenceId, id);
        if (bordereau.getStatut() != StatutBordereauCompagnie.TRANSMIS) {
            throw new BadRequestException("Le bordereau doit être transmis avant rapprochement");
        }
        if (request.getStatut() == StatutRapprochementCompagnie.A_RAPPROCHER) {
            throw new BadRequestException("Sélectionnez un résultat de rapprochement");
        }
        BigDecimal difference = money(request.getEcart());
        if (request.getStatut() == StatutRapprochementCompagnie.RAPPROCHE
                && difference.signum() != 0) {
            throw new BadRequestException("Un bordereau rapproché ne peut pas conserver un écart");
        }
        if (request.getStatut() == StatutRapprochementCompagnie.AVEC_ECART
                && difference.signum() == 0) {
            throw new BadRequestException("Saisissez l'écart constaté");
        }
        if (request.getStatut() == StatutRapprochementCompagnie.AVEC_ECART
                && trimToNull(request.getNote()) == null) {
            throw new BadRequestException("Une justification est obligatoire en présence d'un écart");
        }
        bordereau.setStatutRapprochement(request.getStatut());
        bordereau.setEcartRapprochement(difference);
        bordereau.setNoteRapprochement(trimToNull(request.getNote()));
        bordereau.setDateAccuseReception(request.getDateAccuseReception());
        bordereau.setReferenceAccuseReception(trimToNull(request.getReferenceAccuseReception()));
        return toResponse(
                bordereauRepository.saveAndFlush(bordereau),
                loadAllocationAmounts(List.of(id)).getOrDefault(id, AllocationAmounts.empty()),
                true
        );
    }

    @Transactional
    public BordereauCompagnieResponse cancel(
            Long agenceId,
            Long id,
            AnnulerBordereauCompagnieRequest request
    ) {
        BordereauCompagnie bordereau = lock(agenceId, id);
        if (bordereau.getStatut() == StatutBordereauCompagnie.ANNULE) {
            throw new BadRequestException("Le bordereau est déjà annulé");
        }
        AllocationAmounts amounts = loadAllocationAmounts(List.of(id))
                .getOrDefault(id, AllocationAmounts.empty());
        if (amounts.confirmed().signum() > 0 || amounts.pending().signum() > 0) {
            throw new BadRequestException(
                    "Annulez ou rejetez les règlements liés avant d'annuler le bordereau"
            );
        }
        releaseReservations(bordereau);
        bordereau.setStatut(StatutBordereauCompagnie.ANNULE);
        bordereau.setDateAnnulation(LocalDateTime.now());
        bordereau.setMotifAnnulation(request.getMotif().trim());
        return toResponse(bordereauRepository.saveAndFlush(bordereau), amounts, true);
    }

    private void replaceLines(BordereauCompagnie bordereau, List<Long> requestedIds) {
        List<Long> ids = requestedIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.size() != requestedIds.size()) {
            throw new BadRequestException("Une ligne ne peut apparaître qu'une fois dans le bordereau");
        }
        List<AffectationQuittanceCompagnie> sources = sourceRepository.lockByAgenceIdAndIdIn(
                bordereau.getAgence().getId(),
                ids
        );
        if (sources.size() != ids.size()) {
            throw new BadRequestException("Une ou plusieurs lignes compagnie sont introuvables");
        }
        Map<Long, AffectationQuittanceCompagnie> byId = sources.stream()
                .collect(java.util.stream.Collectors.toMap(
                        AffectationQuittanceCompagnie::getId,
                        Function.identity()
                ));
        int order = 1;
        for (Long id : ids) {
            AffectationQuittanceCompagnie source = byId.get(id);
            validateSource(bordereau, source);
            bordereau.getLignes().add(snapshot(bordereau, source, order++));
        }
        calculateTotals(bordereau);
    }

    private void validateSource(
            BordereauCompagnie bordereau,
            AffectationQuittanceCompagnie source
    ) {
        if (!source.getCompagnieAssurance().getId().equals(bordereau.getCompagnieAssurance().getId())) {
            throw new BadRequestException("Toutes les lignes doivent appartenir à la même compagnie");
        }
        if (source.getDateEffet().isBefore(bordereau.getPeriodeDebut())
                || source.getDateEffet().isAfter(bordereau.getPeriodeFin())) {
            throw new BadRequestException(
                    "La quittance " + source.getNumeroQuittanceCompagnie()
                            + " est hors de la période du bordereau"
            );
        }
        if (ligneRepository.existsByAffectationReserveeId(source.getId())) {
            throw new BadRequestException(
                    "La quittance " + source.getNumeroQuittanceCompagnie()
                            + " appartient déjà à un bordereau actif"
            );
        }
        if (bordereau.getBaseBordereau() == BaseBordereauCompagnie.ENCAISSEMENT
                && !Boolean.TRUE.equals(source.getQuittance().getPayee())) {
            throw new BadRequestException(
                    "La quittance " + source.getNumeroQuittanceCompagnie()
                            + " n'est pas entièrement encaissée"
            );
        }
    }

    private LigneBordereauCompagnie snapshot(
            BordereauCompagnie bordereau,
            AffectationQuittanceCompagnie source,
            int order
    ) {
        return LigneBordereauCompagnie.builder()
                .bordereau(bordereau)
                .affectationSource(source)
                .affectationReservee(source)
                .ordre(order)
                .numeroQuittanceCompagnie(source.getNumeroQuittanceCompagnie())
                .numeroPolice(source.getQuittance().getContrat().getNumeroPolice())
                .numeroDossier(source.getQuittance().getContrat().getNumeroDossier())
                .mouvement(resolveMovement(source))
                .dateEffet(source.getDateEffet())
                .dateEcheance(source.getDateEcheance())
                .primeNette(money(source.getPrimeNette()))
                .montantTaxes(money(source.getMontantTaxes()))
                .accessoires(money(source.getAccessoires()))
                .montantTtc(money(source.getMontantTtc()))
                .commissionNette(money(source.getCommissionNette()))
                .montantRetenue(money(source.getMontantRetenue()))
                .netCompagnie(money(source.getNetCompagnie()))
                .build();
    }

    private void calculateTotals(BordereauCompagnie bordereau) {
        bordereau.setPrimeNette(sumLines(bordereau, LigneBordereauCompagnie::getPrimeNette));
        bordereau.setMontantTaxes(sumLines(bordereau, LigneBordereauCompagnie::getMontantTaxes));
        bordereau.setAccessoires(sumLines(bordereau, LigneBordereauCompagnie::getAccessoires));
        bordereau.setMontantTtc(sumLines(bordereau, LigneBordereauCompagnie::getMontantTtc));
        bordereau.setCommissionNette(sumLines(bordereau, LigneBordereauCompagnie::getCommissionNette));
        bordereau.setMontantRetenue(sumLines(bordereau, LigneBordereauCompagnie::getMontantRetenue));
        bordereau.setNetCompagnie(sumLines(bordereau, LigneBordereauCompagnie::getNetCompagnie));
    }

    private void releaseReservations(BordereauCompagnie bordereau) {
        bordereau.getLignes().forEach(line -> line.setAffectationReservee(null));
        ligneRepository.flush();
    }

    private BordereauCompagnieResponse toResponse(
            BordereauCompagnie bordereau,
            AllocationAmounts amounts,
            boolean includeDetails
    ) {
        BigDecimal remaining = money(bordereau.getNetCompagnie())
                .subtract(amounts.confirmed())
                .max(ZERO);
        return BordereauCompagnieResponse.builder()
                .id(bordereau.getId())
                .numero(bordereau.getNumero())
                .compagnieId(bordereau.getCompagnieAssurance().getId())
                .compagnie(bordereau.getCompagnieAssurance().getNom())
                .baseBordereau(bordereau.getBaseBordereau())
                .statut(bordereau.getStatut())
                .statutRapprochement(bordereau.getStatutRapprochement())
                .statutReglement(paymentStatus(bordereau, amounts, remaining))
                .periodeDebut(bordereau.getPeriodeDebut())
                .periodeFin(bordereau.getPeriodeFin())
                .dateValidation(bordereau.getDateValidation())
                .dateTransmission(bordereau.getDateTransmission())
                .canalTransmission(bordereau.getCanalTransmission())
                .referenceTransmission(bordereau.getReferenceTransmission())
                .dateAccuseReception(bordereau.getDateAccuseReception())
                .referenceAccuseReception(bordereau.getReferenceAccuseReception())
                .primeNette(money(bordereau.getPrimeNette()))
                .montantTaxes(money(bordereau.getMontantTaxes()))
                .accessoires(money(bordereau.getAccessoires()))
                .montantTtc(money(bordereau.getMontantTtc()))
                .commissionNette(money(bordereau.getCommissionNette()))
                .montantRetenue(money(bordereau.getMontantRetenue()))
                .netCompagnie(money(bordereau.getNetCompagnie()))
                .montantRegle(amounts.confirmed())
                .montantEnAttente(amounts.pending())
                .soldeRestant(remaining)
                .ecartRapprochement(money(bordereau.getEcartRapprochement()))
                .noteRapprochement(bordereau.getNoteRapprochement())
                .notes(bordereau.getNotes())
                .creePar(bordereau.getCreePar().getFullName())
                .validePar(bordereau.getValidePar() == null
                        ? null : bordereau.getValidePar().getFullName())
                .dateAnnulation(bordereau.getDateAnnulation())
                .motifAnnulation(bordereau.getMotifAnnulation())
                .lignes(includeDetails ? bordereau.getLignes().stream()
                        .sorted(java.util.Comparator.comparing(LigneBordereauCompagnie::getOrdre))
                        .map(this::toLineResponse)
                        .toList() : List.of())
                .reglements(includeDetails ? allocationRepository.findActiveByBordereauId(
                        bordereau.getId()
                ).stream().map(this::toPaymentResponse).toList() : List.of())
                .build();
    }

    private BordereauCompagnieResponse.Ligne toLineResponse(LigneBordereauCompagnie line) {
        return BordereauCompagnieResponse.Ligne.builder()
                .id(line.getId())
                .affectationId(line.getAffectationSource().getId())
                .ordre(line.getOrdre())
                .numeroQuittanceCompagnie(line.getNumeroQuittanceCompagnie())
                .numeroPolice(line.getNumeroPolice())
                .numeroDossier(line.getNumeroDossier())
                .mouvement(line.getMouvement())
                .dateEffet(line.getDateEffet())
                .dateEcheance(line.getDateEcheance())
                .primeNette(line.getPrimeNette())
                .montantTaxes(line.getMontantTaxes())
                .accessoires(line.getAccessoires())
                .montantTtc(line.getMontantTtc())
                .commissionNette(line.getCommissionNette())
                .montantRetenue(line.getMontantRetenue())
                .netCompagnie(line.getNetCompagnie())
                .build();
    }

    private BordereauCompagnieResponse.Reglement toPaymentResponse(
            AffectationReglementCompagnie allocation
    ) {
        var instrument = allocation.getInstrument();
        return BordereauCompagnieResponse.Reglement.builder()
                .reglementId(instrument.getReglement().getId())
                .numeroReglement(instrument.getReglement().getNumero())
                .instrumentId(instrument.getId())
                .mode(instrument.getMode())
                .statut(instrument.getStatut())
                .montant(instrument.getMontant())
                .montantAffecte(allocation.getMontant())
                .dateInstrument(instrument.getDateInstrument())
                .dateEcheance(instrument.getDateEcheance())
                .referenceInstrument(instrument.getReferenceInstrument())
                .compteTresorerieId(instrument.getCompteTresorerie() == null
                        ? null : instrument.getCompteTresorerie().getId())
                .compteTresorerie(instrument.getCompteTresorerie() == null
                        ? null : instrument.getCompteTresorerie().getLibelle())
                .build();
    }

    private SourceBordereauCompagnieResponse toSourceResponse(
            AffectationQuittanceCompagnie source
    ) {
        return SourceBordereauCompagnieResponse.builder()
                .id(source.getId())
                .compagnieId(source.getCompagnieAssurance().getId())
                .compagnie(source.getCompagnieAssurance().getNom())
                .quittanceId(source.getQuittance().getId())
                .numeroQuittanceCompagnie(source.getNumeroQuittanceCompagnie())
                .numeroPolice(source.getQuittance().getContrat().getNumeroPolice())
                .numeroDossier(source.getQuittance().getContrat().getNumeroDossier())
                .mouvement(resolveMovement(source))
                .dateEffet(source.getDateEffet())
                .dateEcheance(source.getDateEcheance())
                .primeNette(money(source.getPrimeNette()))
                .montantTaxes(money(source.getMontantTaxes()))
                .accessoires(money(source.getAccessoires()))
                .montantTtc(money(source.getMontantTtc()))
                .commissionNette(money(source.getCommissionNette()))
                .montantRetenue(money(source.getMontantRetenue()))
                .netCompagnie(money(source.getNetCompagnie()))
                .encaissementConfirme(Boolean.TRUE.equals(source.getQuittance().getPayee()))
                .build();
    }

    private Map<Long, AllocationAmounts> loadAllocationAmounts(Collection<Long> bordereauIds) {
        if (bordereauIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, AllocationAmounts> result = new HashMap<>();
        for (Object[] row : allocationRepository.sumByBordereauIds(bordereauIds)) {
            Long id = (Long) row[0];
            StatutAffectationReglement status = (StatutAffectationReglement) row[1];
            BigDecimal amount = money((BigDecimal) row[2]);
            AllocationAmounts current = result.getOrDefault(id, AllocationAmounts.empty());
            result.put(id, status == StatutAffectationReglement.CONFIRMEE
                    ? new AllocationAmounts(current.confirmed().add(amount), current.pending())
                    : new AllocationAmounts(current.confirmed(), current.pending().add(amount)));
        }
        return result;
    }

    private String paymentStatus(
            BordereauCompagnie bordereau,
            AllocationAmounts amounts,
            BigDecimal remaining
    ) {
        if (bordereau.getStatut() == StatutBordereauCompagnie.ANNULE) {
            return "ANNULE";
        }
        if (remaining.signum() == 0) {
            return "REGLE";
        }
        if (amounts.confirmed().signum() > 0) {
            return "PARTIELLEMENT_REGLE";
        }
        if (amounts.pending().signum() > 0) {
            return "EN_ATTENTE";
        }
        return "NON_REGLE";
    }

    private String resolveMovement(AffectationQuittanceCompagnie source) {
        if (trimToNull(source.getActeSource()) != null) {
            return source.getActeSource().trim();
        }
        if (source.getQuittance().getMouvementContrat() != null) {
            var mouvement = source.getQuittance().getMouvementContrat();
            if (mouvement.getTypeMouvement() != null
                    && trimToNull(mouvement.getTypeMouvement().getLibelle()) != null) {
                return mouvement.getTypeMouvement().getLibelle().trim();
            }
            if (trimToNull(mouvement.getNumeroMouvement()) != null) {
                return mouvement.getNumeroMouvement().trim();
            }
        }
        return source.getQuittance().getType();
    }

    private boolean matches(AffectationQuittanceCompagnie source, String search) {
        if (search == null) {
            return true;
        }
        return List.of(
                        source.getNumeroQuittanceCompagnie(),
                        source.getQuittance().getContrat().getNumeroPolice(),
                        source.getQuittance().getContrat().getNumeroDossier(),
                        resolveMovement(source)
                ).stream()
                .filter(Objects::nonNull)
                .anyMatch(value -> value.toLowerCase(Locale.ROOT).contains(search));
    }

    private CompagnieAssurance findActiveCompany(Long id) {
        CompagnieAssurance company = compagnieRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Compagnie", id));
        if (!Boolean.TRUE.equals(company.getActif())) {
            throw new BadRequestException("La compagnie sélectionnée est inactive");
        }
        return company;
    }

    private BordereauCompagnie lock(Long agencyId, Long id) {
        return bordereauRepository.lockByIdAndAgenceId(id, agencyId)
                .orElseThrow(() -> new ResourceNotFoundException("Bordereau compagnie", id));
    }

    private void requireDraft(BordereauCompagnie bordereau) {
        if (bordereau.getStatut() != StatutBordereauCompagnie.BROUILLON) {
            throw new BadRequestException("Seul un bordereau brouillon peut être modifié");
        }
    }

    private String nextNumber(Agence agency, int year) {
        SequenceBordereauCompagnie sequence = sequenceRepository.findByAgenceIdAndAnnee(
                agency.getId(),
                year
        ).orElseGet(() -> SequenceBordereauCompagnie.builder()
                .agence(agency)
                .annee(year)
                .valeur(0L)
                .build());
        sequence.setValeur(sequence.getValeur() + 1);
        sequenceRepository.save(sequence);
        return "BOR-" + agency.getCode() + "-" + year + "-"
                + String.format(Locale.ROOT, "%06d", sequence.getValeur());
    }

    private Utilisateur currentUser() {
        Long userId = TenantContext.getCurrentUser();
        if (userId == null) {
            throw new UnauthorizedException("Utilisateur non authentifié");
        }
        return utilisateurRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("Utilisateur non authentifié"));
    }

    private void validatePeriod(LocalDate dateDu, LocalDate dateAu) {
        if (dateDu != null && dateAu != null && dateDu.isAfter(dateAu)) {
            throw new BadRequestException("La date de début doit précéder la date de fin");
        }
    }

    private String normalizeSearch(String value) {
        return trimToNull(value) == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal sumLines(
            BordereauCompagnie bordereau,
            Function<LigneBordereauCompagnie, BigDecimal> extractor
    ) {
        return bordereau.getLignes().stream()
                .map(extractor)
                .map(this::money)
                .reduce(ZERO, BigDecimal::add);
    }

    private BigDecimal sum(
            Collection<BordereauCompagnieResponse> rows,
            Function<BordereauCompagnieResponse, BigDecimal> extractor
    ) {
        return rows.stream().map(extractor).map(this::money).reduce(ZERO, BigDecimal::add);
    }

    private record AllocationAmounts(BigDecimal confirmed, BigDecimal pending) {
        private static AllocationAmounts empty() {
            return new AllocationAmounts(ZERO, ZERO);
        }
    }
}
