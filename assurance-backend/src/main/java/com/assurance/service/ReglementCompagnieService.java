package com.assurance.service;

import com.assurance.dto.request.AnnulerBordereauCompagnieRequest;
import com.assurance.dto.request.ChangerStatutInstrumentCompagnieRequest;
import com.assurance.dto.request.CreerReglementCompagnieRequest;
import com.assurance.dto.response.ReglementCompagnieResponse;
import com.assurance.entity.AffectationReglementCompagnie;
import com.assurance.entity.Agence;
import com.assurance.entity.BordereauCompagnie;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.InstrumentReglementCompagnie;
import com.assurance.entity.ReglementCompagnie;
import com.assurance.entity.SequenceReglementCompagnie;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.ModeReglementCompagnie;
import com.assurance.enums.StatutAffectationReglement;
import com.assurance.enums.StatutBordereauCompagnie;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutReglementCompagnie;
import com.assurance.enums.TypeCompteTresorerie;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.exception.UnauthorizedException;
import com.assurance.repository.AffectationReglementCompagnieRepository;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.BordereauCompagnieRepository;
import com.assurance.repository.CompagnieAssuranceRepository;
import com.assurance.repository.InstrumentReglementCompagnieRepository;
import com.assurance.repository.ReglementCompagnieRepository;
import com.assurance.repository.SequenceReglementCompagnieRepository;
import com.assurance.repository.UtilisateurRepository;
import com.assurance.security.TenantContext;
import lombok.RequiredArgsConstructor;
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
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReglementCompagnieService {

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final ReglementCompagnieRepository reglementRepository;
    private final InstrumentReglementCompagnieRepository instrumentRepository;
    private final AffectationReglementCompagnieRepository allocationRepository;
    private final BordereauCompagnieRepository bordereauRepository;
    private final SequenceReglementCompagnieRepository sequenceRepository;
    private final AgenceRepository agenceRepository;
    private final CompagnieAssuranceRepository compagnieRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final TresorerieService tresorerieService;

    @Transactional
    public ReglementCompagnieResponse create(
            Long agenceId,
            CreerReglementCompagnieRequest request
    ) {
        CompagnieAssurance company = findActiveCompany(request.getCompagnieId());
        List<CreerReglementCompagnieRequest.Instrument> requestedInstruments = request.getInstruments();
        validateDuplicateAllocations(requestedInstruments);
        Map<Long, BigDecimal> requestedByBordereau = requestedAmounts(requestedInstruments);
        List<Long> bordereauIds = requestedByBordereau.keySet().stream().sorted().toList();
        List<BordereauCompagnie> bordereaux = bordereauRepository.lockByAgenceIdAndIdIn(
                agenceId,
                bordereauIds
        );
        if (bordereaux.size() != bordereauIds.size()) {
            throw new BadRequestException("Un ou plusieurs bordereaux sont introuvables");
        }
        Map<Long, BordereauCompagnie> byId = bordereaux.stream().collect(Collectors.toMap(
                BordereauCompagnie::getId,
                Function.identity()
        ));
        Map<Long, AllocationAmounts> currentAmounts = loadAllocationAmounts(bordereauIds);
        for (Map.Entry<Long, BigDecimal> requested : requestedByBordereau.entrySet()) {
            BordereauCompagnie bordereau = byId.get(requested.getKey());
            validateBordereau(company, bordereau);
            AllocationAmounts current = currentAmounts.getOrDefault(
                    bordereau.getId(),
                    AllocationAmounts.empty()
            );
            BigDecimal available = money(bordereau.getNetCompagnie())
                    .subtract(current.confirmed())
                    .subtract(current.pending());
            if (requested.getValue().compareTo(available) > 0) {
                throw new BadRequestException(
                        "Le montant affecté dépasse le solde du bordereau " + bordereau.getNumero()
                );
            }
        }

        BigDecimal totalPayment = sumInstruments(requestedInstruments);
        BigDecimal totalAllocated = requestedByBordereau.values().stream()
                .reduce(ZERO, BigDecimal::add);
        if (totalAllocated.compareTo(totalPayment) != 0) {
            throw new BadRequestException(
                    "Le total ventilé doit correspondre au montant des moyens de paiement"
            );
        }

        Agence agency = agenceRepository.findByIdForUpdate(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        Utilisateur actor = currentUser();
        ReglementCompagnie payment = ReglementCompagnie.builder()
                .agence(agency)
                .compagnieAssurance(company)
                .numero(nextNumber(agency, request.getDateReglement().getYear()))
                .dateReglement(request.getDateReglement())
                .statut(StatutReglementCompagnie.VALIDE)
                .montantTotal(totalPayment)
                .montantNonAffecte(ZERO)
                .notes(trimToNull(request.getNotes()))
                .creePar(actor)
                .build();

        for (CreerReglementCompagnieRequest.Instrument requested : requestedInstruments) {
            InstrumentReglementCompagnie instrument = buildInstrument(agency, payment, requested);
            payment.getInstruments().add(instrument);
            for (CreerReglementCompagnieRequest.Affectation requestedAllocation
                    : requested.getAffectations()) {
                instrument.getAffectations().add(AffectationReglementCompagnie.builder()
                        .instrument(instrument)
                        .bordereau(byId.get(requestedAllocation.getBordereauId()))
                        .montant(money(requestedAllocation.getMontant()))
                        .statut(instrument.getStatut() == StatutInstrumentReglement.CONFIRME
                                ? StatutAffectationReglement.CONFIRMEE
                                : StatutAffectationReglement.EN_ATTENTE)
                        .build());
            }
        }

        payment = reglementRepository.saveAndFlush(payment);
        return toResponse(payment);
    }

    @Transactional(readOnly = true)
    public ReglementCompagnieResponse get(Long agenceId, Long id) {
        return toResponse(findPayment(agenceId, id));
    }

    @Transactional
    public ReglementCompagnieResponse changeInstrumentStatus(
            Long agenceId,
            Long instrumentId,
            ChangerStatutInstrumentCompagnieRequest request
    ) {
        InstrumentReglementCompagnie instrument = instrumentRepository.lockByIdAndAgenceId(
                instrumentId,
                agenceId
        ).orElseThrow(() -> new ResourceNotFoundException("Moyen de paiement compagnie", instrumentId));
        if (instrument.getReglement().getStatut() == StatutReglementCompagnie.ANNULE) {
            throw new BadRequestException("Le règlement compagnie est annulé");
        }
        LocalDate operationDate = request.getDateOperation() == null
                ? LocalDate.now() : request.getDateOperation();
        if (request.getStatut() == StatutInstrumentReglement.CONFIRME) {
            confirmInstrument(agenceId, instrument, request.getCompteTresorerieId(), operationDate);
        } else if (request.getStatut() == StatutInstrumentReglement.REJETE) {
            rejectInstrument(instrument, request.getMotif(), operationDate);
        } else {
            throw new BadRequestException("Cette transition de statut n'est pas autorisée");
        }
        instrument.setDateStatut(operationDate);
        instrument.setMotifStatut(trimToNull(request.getMotif()));
        instrumentRepository.saveAndFlush(instrument);
        return toResponse(instrument.getReglement());
    }

    @Transactional
    public ReglementCompagnieResponse cancel(
            Long agenceId,
            Long paymentId,
            AnnulerBordereauCompagnieRequest request
    ) {
        ReglementCompagnie payment = findPayment(agenceId, paymentId);
        if (payment.getStatut() == StatutReglementCompagnie.ANNULE) {
            return toResponse(payment);
        }
        LocalDate operationDate = LocalDate.now();
        for (InstrumentReglementCompagnie instrument : payment.getInstruments()) {
            if (instrument.getStatut() == StatutInstrumentReglement.CONFIRME
                    && instrument.getMode() != ModeReglementCompagnie.COMPENSATION) {
                tresorerieService.reverseCompanyInstrumentExit(
                        instrument,
                        request.getMotif().trim(),
                        operationDate
                );
            }
            instrument.setStatut(StatutInstrumentReglement.REJETE);
            instrument.setDateStatut(operationDate);
            instrument.setMotifStatut(request.getMotif().trim());
            instrument.getAffectations().forEach(allocation ->
                    allocation.setStatut(StatutAffectationReglement.ANNULEE));
        }
        payment.setStatut(StatutReglementCompagnie.ANNULE);
        payment.setDateAnnulation(LocalDateTime.now());
        payment.setMotifAnnulation(request.getMotif().trim());
        payment.setMontantNonAffecte(ZERO);
        return toResponse(reglementRepository.saveAndFlush(payment));
    }

    private InstrumentReglementCompagnie buildInstrument(
            Agence agency,
            ReglementCompagnie payment,
            CreerReglementCompagnieRequest.Instrument request
    ) {
        validateInstrument(request);
        CompteTresorerie account = null;
        if (request.getCompteTresorerieId() != null) {
            account = tresorerieService.findAccount(agency.getId(), request.getCompteTresorerieId());
            requireActiveBankAccount(account);
        }
        boolean compensation = request.getMode() == ModeReglementCompagnie.COMPENSATION;
        if (compensation && account != null) {
            throw new BadRequestException("Une compensation ne doit pas mouvementer un compte bancaire");
        }
        return InstrumentReglementCompagnie.builder()
                .agence(agency)
                .reglement(payment)
                .mode(request.getMode())
                .statut(compensation
                        ? StatutInstrumentReglement.CONFIRME
                        : StatutInstrumentReglement.EN_ATTENTE)
                .montant(money(request.getMontant()))
                .dateInstrument(request.getDateInstrument())
                .dateEcheance(request.getDateEcheance())
                .referenceInstrument(trimToNull(request.getReferenceInstrument()))
                .banqueBeneficiaire(trimToNull(request.getBanqueBeneficiaire()))
                .compteTresorerie(account)
                .dateStatut(payment.getDateReglement())
                .build();
    }

    private void confirmInstrument(
            Long agenceId,
            InstrumentReglementCompagnie instrument,
            Long accountId,
            LocalDate operationDate
    ) {
        if (instrument.getStatut() != StatutInstrumentReglement.EN_ATTENTE) {
            throw new BadRequestException("Seul un moyen de paiement en attente peut être confirmé");
        }
        CompteTresorerie account = accountId == null
                ? instrument.getCompteTresorerie()
                : tresorerieService.findAccount(agenceId, accountId);
        if (account == null) {
            throw new BadRequestException("Sélectionnez le compte bancaire débité");
        }
        requireActiveBankAccount(account);
        instrument.setCompteTresorerie(account);
        instrument.setStatut(StatutInstrumentReglement.CONFIRME);
        instrument.getAffectations().forEach(allocation ->
                allocation.setStatut(StatutAffectationReglement.CONFIRMEE));
        instrumentRepository.saveAndFlush(instrument);
        tresorerieService.recordCompanyInstrumentExit(instrument, account, operationDate);
    }

    private void rejectInstrument(
            InstrumentReglementCompagnie instrument,
            String reason,
            LocalDate operationDate
    ) {
        if (instrument.getStatut() != StatutInstrumentReglement.EN_ATTENTE
                && instrument.getStatut() != StatutInstrumentReglement.CONFIRME) {
            throw new BadRequestException("Ce moyen de paiement ne peut pas être rejeté");
        }
        if (trimToNull(reason) == null) {
            throw new BadRequestException("Le motif du rejet est obligatoire");
        }
        if (instrument.getStatut() == StatutInstrumentReglement.CONFIRME
                && instrument.getMode() != ModeReglementCompagnie.COMPENSATION) {
            tresorerieService.reverseCompanyInstrumentExit(
                    instrument,
                    reason.trim(),
                    operationDate
            );
        }
        instrument.setStatut(StatutInstrumentReglement.REJETE);
        instrument.getAffectations().forEach(allocation ->
                allocation.setStatut(StatutAffectationReglement.ANNULEE));
    }

    private void validateInstrument(CreerReglementCompagnieRequest.Instrument request) {
        BigDecimal allocated = request.getAffectations().stream()
                .map(CreerReglementCompagnieRequest.Affectation::getMontant)
                .map(this::money)
                .reduce(ZERO, BigDecimal::add);
        if (allocated.compareTo(money(request.getMontant())) != 0) {
            throw new BadRequestException(
                    "La ventilation doit correspondre au montant du moyen de paiement"
            );
        }
        if (request.getMode() != ModeReglementCompagnie.COMPENSATION
                && trimToNull(request.getReferenceInstrument()) == null) {
            throw new BadRequestException("La référence du moyen de paiement est obligatoire");
        }
        if (request.getMode() == ModeReglementCompagnie.EFFET
                && request.getDateEcheance() == null) {
            throw new BadRequestException("L'échéance de l'effet est obligatoire");
        }
    }

    private void validateDuplicateAllocations(
            List<CreerReglementCompagnieRequest.Instrument> instruments
    ) {
        for (CreerReglementCompagnieRequest.Instrument instrument : instruments) {
            Set<Long> duplicates = instrument.getAffectations().stream()
                    .collect(Collectors.groupingBy(
                            CreerReglementCompagnieRequest.Affectation::getBordereauId,
                            Collectors.counting()
                    ))
                    .entrySet().stream()
                    .filter(entry -> entry.getValue() > 1)
                    .map(Map.Entry::getKey)
                    .collect(Collectors.toSet());
            if (!duplicates.isEmpty()) {
                throw new BadRequestException(
                        "Un bordereau ne peut apparaître qu'une fois par moyen de paiement"
                );
            }
        }
    }

    private void validateBordereau(
            CompagnieAssurance company,
            BordereauCompagnie bordereau
    ) {
        if (!bordereau.getCompagnieAssurance().getId().equals(company.getId())) {
            throw new BadRequestException("Tous les bordereaux doivent appartenir à la même compagnie");
        }
        if (bordereau.getStatut() != StatutBordereauCompagnie.TRANSMIS) {
            throw new BadRequestException(
                    "Le bordereau " + bordereau.getNumero() + " doit être transmis avant règlement"
            );
        }
    }

    private void requireActiveBankAccount(CompteTresorerie account) {
        if (!Boolean.TRUE.equals(account.getActif())
                || account.getTypeCompte() != TypeCompteTresorerie.BANQUE) {
            throw new BadRequestException("Sélectionnez un compte bancaire actif");
        }
    }

    private Map<Long, BigDecimal> requestedAmounts(
            List<CreerReglementCompagnieRequest.Instrument> instruments
    ) {
        Map<Long, BigDecimal> result = new HashMap<>();
        instruments.forEach(instrument -> instrument.getAffectations().forEach(allocation ->
                result.merge(
                        allocation.getBordereauId(),
                        money(allocation.getMontant()),
                        BigDecimal::add
                )));
        return result;
    }

    private BigDecimal sumInstruments(
            List<CreerReglementCompagnieRequest.Instrument> instruments
    ) {
        return instruments.stream()
                .map(CreerReglementCompagnieRequest.Instrument::getMontant)
                .map(this::money)
                .reduce(ZERO, BigDecimal::add);
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

    private ReglementCompagnieResponse toResponse(ReglementCompagnie payment) {
        return ReglementCompagnieResponse.builder()
                .id(payment.getId())
                .numero(payment.getNumero())
                .compagnieId(payment.getCompagnieAssurance().getId())
                .compagnie(payment.getCompagnieAssurance().getNom())
                .dateReglement(payment.getDateReglement())
                .statut(payment.getStatut())
                .montantTotal(payment.getMontantTotal())
                .montantNonAffecte(payment.getMontantNonAffecte())
                .notes(payment.getNotes())
                .creePar(payment.getCreePar().getFullName())
                .dateAnnulation(payment.getDateAnnulation())
                .motifAnnulation(payment.getMotifAnnulation())
                .instruments(payment.getInstruments().stream()
                        .map(this::toInstrumentResponse)
                        .toList())
                .build();
    }

    private ReglementCompagnieResponse.Instrument toInstrumentResponse(
            InstrumentReglementCompagnie instrument
    ) {
        return ReglementCompagnieResponse.Instrument.builder()
                .id(instrument.getId())
                .mode(instrument.getMode())
                .statut(instrument.getStatut())
                .montant(instrument.getMontant())
                .dateInstrument(instrument.getDateInstrument())
                .dateEcheance(instrument.getDateEcheance())
                .dateStatut(instrument.getDateStatut())
                .referenceInstrument(instrument.getReferenceInstrument())
                .banqueBeneficiaire(instrument.getBanqueBeneficiaire())
                .motifStatut(instrument.getMotifStatut())
                .compteTresorerieId(instrument.getCompteTresorerie() == null
                        ? null : instrument.getCompteTresorerie().getId())
                .compteTresorerie(instrument.getCompteTresorerie() == null
                        ? null : instrument.getCompteTresorerie().getLibelle())
                .affectations(instrument.getAffectations().stream()
                        .map(allocation -> ReglementCompagnieResponse.Affectation.builder()
                                .bordereauId(allocation.getBordereau().getId())
                                .numeroBordereau(allocation.getBordereau().getNumero())
                                .montant(allocation.getMontant())
                                .statut(allocation.getStatut().name())
                                .build())
                        .toList())
                .build();
    }

    private ReglementCompagnie findPayment(Long agenceId, Long id) {
        return reglementRepository.findByIdAndAgenceId(id, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Règlement compagnie", id));
    }

    private CompagnieAssurance findActiveCompany(Long id) {
        CompagnieAssurance company = compagnieRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Compagnie", id));
        if (!Boolean.TRUE.equals(company.getActif())) {
            throw new BadRequestException("La compagnie sélectionnée est inactive");
        }
        return company;
    }

    private String nextNumber(Agence agency, int year) {
        SequenceReglementCompagnie sequence = sequenceRepository.findByAgenceIdAndAnnee(
                agency.getId(),
                year
        ).orElseGet(() -> SequenceReglementCompagnie.builder()
                .agence(agency)
                .annee(year)
                .valeur(0L)
                .build());
        sequence.setValeur(sequence.getValeur() + 1);
        sequenceRepository.save(sequence);
        return "RGC-" + agency.getCode() + "-" + year + "-"
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

    private BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record AllocationAmounts(BigDecimal confirmed, BigDecimal pending) {
        private static AllocationAmounts empty() {
            return new AllocationAmounts(ZERO, ZERO);
        }
    }
}
