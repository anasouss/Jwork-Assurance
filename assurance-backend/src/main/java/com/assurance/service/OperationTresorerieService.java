package com.assurance.service;

import com.assurance.dto.request.AnnulerOperationTresorerieRequest;
import com.assurance.dto.request.CreerAjustementTresorerieRequest;
import com.assurance.dto.request.CreerTransfertTresorerieRequest;
import com.assurance.dto.response.OperationTresoreriePageResponse;
import com.assurance.dto.response.OperationTresorerieResponse;
import com.assurance.dto.response.SourceDocumentClientPageResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.MouvementTresorerie;
import com.assurance.entity.OperationTresorerie;
import com.assurance.entity.SequenceOperationTresorerie;
import com.assurance.entity.SessionCaisse;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.NatureMouvementTresorerie;
import com.assurance.enums.NiveauAccesCompteTresorerie;
import com.assurance.enums.SensMouvementTresorerie;
import com.assurance.enums.StatutOperationTresorerie;
import com.assurance.enums.TypeOperationTresorerie;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.CompteTresorerieRepository;
import com.assurance.repository.MouvementTresorerieRepository;
import com.assurance.repository.OperationTresorerieRepository;
import com.assurance.repository.SequenceOperationTresorerieRepository;
import com.assurance.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class OperationTresorerieService {

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final OperationTresorerieRepository operationRepository;
    private final SequenceOperationTresorerieRepository sequenceRepository;
    private final MouvementTresorerieRepository mouvementRepository;
    private final CompteTresorerieRepository compteRepository;
    private final AgenceRepository agenceRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final TresorerieAccessService accessService;
    private final SessionCaisseService sessionService;

    @Transactional(readOnly = true)
    public OperationTresoreriePageResponse search(
            Long agenceId,
            Long compteId,
            TypeOperationTresorerie type,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            int page,
            int size
    ) {
        validatePeriod(dateDu, dateAu);
        List<Long> visibleIds = accessService.visibleAccounts(
                agenceId,
                accessService.currentUserId()
        ).stream().map(CompteTresorerie::getId).toList();
        if (visibleIds.isEmpty()) {
            return OperationTresoreriePageResponse.builder()
                    .page(emptyPage(page, size))
                    .rows(List.of())
                    .build();
        }
        if (compteId != null && !visibleIds.contains(compteId)) {
            throw new AccessDeniedException("Ce compte de trésorerie ne vous est pas affecté");
        }
        Page<OperationTresorerie> result = operationRepository.search(
                agenceId,
                visibleIds,
                compteId,
                type,
                dateDu,
                dateAu,
                normalizeSearch(search),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100))
        );
        return OperationTresoreriePageResponse.builder()
                .page(pageInfo(result))
                .rows(result.getContent().stream().map(this::toResponse).toList())
                .build();
    }

    @Transactional
    public OperationTresorerieResponse createTransfer(Long agenceId, CreerTransfertTresorerieRequest request) {
        if (request.getCompteSourceId().equals(request.getCompteDestinationId())) {
            throw new BadRequestException("Les comptes source et destination doivent être différents");
        }
        CompteTresorerie source = requireActiveAccount(agenceId, request.getCompteSourceId());
        CompteTresorerie destination = requireActiveAccount(agenceId, request.getCompteDestinationId());
        accessService.requireAccess(agenceId, source.getId(), NiveauAccesCompteTresorerie.GESTION);
        accessService.requireAccess(agenceId, destination.getId(), NiveauAccesCompteTresorerie.GESTION);
        BigDecimal amount = positiveMoney(request.getMontant());
        requireSufficientBalance(source, amount);

        OperationTresorerie operation = buildOperation(
                agenceId,
                TypeOperationTresorerie.TRANSFERT,
                source,
                destination,
                null,
                amount,
                request.getDateOperation(),
                request.getDateValeur(),
                request.getReference(),
                request.getMotif(),
                null
        );
        operation = operationRepository.save(operation);
        mouvementRepository.save(buildMovement(
                operation,
                source,
                SensMouvementTresorerie.SORTIE,
                sessionService.requireOpenSession(agenceId, source),
                "Transfert vers " + destination.getLibelle(),
                null
        ));
        mouvementRepository.save(buildMovement(
                operation,
                destination,
                SensMouvementTresorerie.ENTREE,
                sessionService.requireOpenSession(agenceId, destination),
                "Transfert depuis " + source.getLibelle(),
                null
        ));
        return toResponse(operation);
    }

    @Transactional
    public OperationTresorerieResponse createAdjustment(
            Long agenceId,
            CreerAjustementTresorerieRequest request
    ) {
        CompteTresorerie account = requireActiveAccount(agenceId, request.getCompteTresorerieId());
        accessService.requireAccess(agenceId, account.getId(), NiveauAccesCompteTresorerie.SUPERVISION);
        BigDecimal amount = positiveMoney(request.getMontant());
        if (request.getSens() == SensMouvementTresorerie.SORTIE) {
            requireSufficientBalance(account, amount);
        }
        OperationTresorerie operation = buildOperation(
                agenceId,
                TypeOperationTresorerie.AJUSTEMENT,
                request.getSens() == SensMouvementTresorerie.SORTIE ? account : null,
                request.getSens() == SensMouvementTresorerie.ENTREE ? account : null,
                request.getSens(),
                amount,
                request.getDateOperation(),
                request.getDateValeur(),
                request.getReference(),
                request.getMotif(),
                null
        );
        operation = operationRepository.save(operation);
        mouvementRepository.save(buildMovement(
                operation,
                account,
                request.getSens(),
                sessionService.requireOpenSession(agenceId, account),
                "Ajustement de trésorerie",
                null
        ));
        return toResponse(operation);
    }

    @Transactional
    public OperationTresorerieResponse cancel(
            Long agenceId,
            Long operationId,
            AnnulerOperationTresorerieRequest request
    ) {
        OperationTresorerie original = operationRepository.findByIdAndAgenceId(operationId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Opération de trésorerie", operationId));
        if (original.getStatut() == StatutOperationTresorerie.ANNULEE
                || operationRepository.existsByAgenceIdAndOperationExtourneeId(agenceId, operationId)) {
            throw new BadRequestException("Cette opération est déjà annulée");
        }
        if (original.getTypeOperation() == TypeOperationTresorerie.ANNULATION_TRANSFERT
                || original.getTypeOperation() == TypeOperationTresorerie.ANNULATION_AJUSTEMENT) {
            throw new BadRequestException("Une écriture d'annulation ne peut pas être annulée");
        }
        requireSupervisor(agenceId, original);
        List<MouvementTresorerie> originalMovements = mouvementRepository
                .findByAgenceIdAndOperationTresorerieIdOrderByIdAsc(agenceId, operationId);
        for (MouvementTresorerie movement : originalMovements) {
            if (movement.getSens() == SensMouvementTresorerie.ENTREE) {
                requireSufficientBalance(movement.getCompteTresorerie(), movement.getMontant());
            }
        }

        TypeOperationTresorerie reversalType = original.getTypeOperation() == TypeOperationTresorerie.TRANSFERT
                ? TypeOperationTresorerie.ANNULATION_TRANSFERT
                : TypeOperationTresorerie.ANNULATION_AJUSTEMENT;
        OperationTresorerie reversal = buildOperation(
                agenceId,
                reversalType,
                original.getCompteDestination(),
                original.getCompteSource(),
                original.getSensAjustement() == null ? null : inverse(original.getSensAjustement()),
                original.getMontant(),
                request.getDateOperation(),
                request.getDateOperation(),
                original.getNumero(),
                request.getMotif(),
                original
        );
        reversal = operationRepository.save(reversal);
        for (MouvementTresorerie movement : originalMovements) {
            SensMouvementTresorerie inverseDirection = inverse(movement.getSens());
            mouvementRepository.save(buildMovement(
                    reversal,
                    movement.getCompteTresorerie(),
                    inverseDirection,
                    sessionService.requireOpenSession(agenceId, movement.getCompteTresorerie()),
                    "Annulation de " + original.getNumero(),
                    movement.getId()
            ));
        }
        original.setStatut(StatutOperationTresorerie.ANNULEE);
        original.setAnnuleeLe(LocalDateTime.now());
        original.setMotifAnnulation(request.getMotif().trim());
        operationRepository.save(original);
        return toResponse(reversal);
    }

    private OperationTresorerie buildOperation(
            Long agenceId,
            TypeOperationTresorerie type,
            CompteTresorerie source,
            CompteTresorerie destination,
            SensMouvementTresorerie adjustmentDirection,
            BigDecimal amount,
            LocalDate operationDate,
            LocalDate valueDate,
            String reference,
            String reason,
            OperationTresorerie reversedOperation
    ) {
        Agence agency = agenceRepository.findByIdForUpdate(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        Utilisateur actor = utilisateurRepository.findById(accessService.currentUserId())
                .orElseThrow(() -> new AccessDeniedException("Utilisateur non authentifié"));
        return OperationTresorerie.builder()
                .agence(agency)
                .numero(nextNumber(agency, operationDate.getYear()))
                .typeOperation(type)
                .statut(StatutOperationTresorerie.CONFIRMEE)
                .compteSource(source)
                .compteDestination(destination)
                .sensAjustement(adjustmentDirection)
                .montant(amount)
                .dateOperation(operationDate)
                .dateValeur(valueDate == null ? operationDate : valueDate)
                .reference(trimToNull(reference))
                .motif(reason.trim())
                .confirmeeLe(LocalDateTime.now())
                .confirmeePar(actor)
                .operationExtournee(reversedOperation)
                .build();
    }

    private MouvementTresorerie buildMovement(
            OperationTresorerie operation,
            CompteTresorerie account,
            SensMouvementTresorerie direction,
            SessionCaisse session,
            String label,
            Long reversedMovementId
    ) {
        return MouvementTresorerie.builder()
                .agence(operation.getAgence())
                .compteTresorerie(account)
                .operationTresorerie(operation)
                .sessionCaisse(session)
                .nature(operation.getTypeOperation() == TypeOperationTresorerie.AJUSTEMENT
                        || operation.getTypeOperation() == TypeOperationTresorerie.ANNULATION_AJUSTEMENT
                        ? NatureMouvementTresorerie.AJUSTEMENT
                        : NatureMouvementTresorerie.TRANSFERT)
                .sens(direction)
                .dateOperation(operation.getDateOperation())
                .dateValeur(operation.getDateValeur())
                .montant(operation.getMontant())
                .reference(operation.getReference())
                .libelle(label)
                .mouvementExtourneId(reversedMovementId)
                .build();
    }

    private void requireSupervisor(Long agenceId, OperationTresorerie operation) {
        if (operation.getCompteSource() != null) {
            accessService.requireAccess(
                    agenceId,
                    operation.getCompteSource().getId(),
                    NiveauAccesCompteTresorerie.SUPERVISION
            );
        }
        if (operation.getCompteDestination() != null) {
            accessService.requireAccess(
                    agenceId,
                    operation.getCompteDestination().getId(),
                    NiveauAccesCompteTresorerie.SUPERVISION
            );
        }
    }

    private CompteTresorerie requireActiveAccount(Long agenceId, Long accountId) {
        CompteTresorerie account = compteRepository.findByIdAndAgenceId(accountId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Compte de trésorerie", accountId));
        if (!Boolean.TRUE.equals(account.getActif())) {
            throw new BadRequestException("Le compte " + account.getLibelle() + " est inactif");
        }
        return account;
    }

    private void requireSufficientBalance(CompteTresorerie account, BigDecimal amount) {
        BigDecimal available = money(account.getSoldeInitial())
                .add(money(mouvementRepository.balanceForAccount(account.getId())));
        if (available.compareTo(amount) < 0) {
            throw new BadRequestException("Solde insuffisant sur le compte " + account.getLibelle());
        }
    }

    private String nextNumber(Agence agency, int year) {
        SequenceOperationTresorerie sequence = sequenceRepository.findByAgenceIdAndAnnee(
                agency.getId(),
                year
        ).orElseGet(() -> SequenceOperationTresorerie.builder()
                .agence(agency)
                .annee(year)
                .valeur(0L)
                .build());
        sequence.setValeur(sequence.getValeur() + 1);
        sequenceRepository.save(sequence);
        return "TR-" + String.format("%03d", agency.getId()) + "-" + year + "-"
                + String.format("%06d", sequence.getValeur());
    }

    private OperationTresorerieResponse toResponse(OperationTresorerie operation) {
        return OperationTresorerieResponse.builder()
                .id(operation.getId())
                .numero(operation.getNumero())
                .typeOperation(operation.getTypeOperation())
                .statut(operation.getStatut())
                .compteSourceId(id(operation.getCompteSource()))
                .compteSource(label(operation.getCompteSource()))
                .compteDestinationId(id(operation.getCompteDestination()))
                .compteDestination(label(operation.getCompteDestination()))
                .sensAjustement(operation.getSensAjustement())
                .montant(money(operation.getMontant()))
                .dateOperation(operation.getDateOperation())
                .dateValeur(operation.getDateValeur())
                .reference(operation.getReference())
                .motif(operation.getMotif())
                .confirmeeLe(operation.getConfirmeeLe())
                .confirmeeParId(operation.getConfirmeePar().getId())
                .confirmeePar(operation.getConfirmeePar().getFullName())
                .operationExtourneeId(operation.getOperationExtournee() == null
                        ? null : operation.getOperationExtournee().getId())
                .operationExtourneeNumero(operation.getOperationExtournee() == null
                        ? null : operation.getOperationExtournee().getNumero())
                .annuleeLe(operation.getAnnuleeLe())
                .motifAnnulation(operation.getMotifAnnulation())
                .build();
    }

    private void validatePeriod(LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new BadRequestException("La date de début doit précéder la date de fin");
        }
    }

    private SourceDocumentClientPageResponse.PageInfo pageInfo(Page<?> page) {
        return SourceDocumentClientPageResponse.PageInfo.builder()
                .number(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .first(page.isFirst())
                .last(page.isLast())
                .build();
    }

    private SourceDocumentClientPageResponse.PageInfo emptyPage(int page, int size) {
        return SourceDocumentClientPageResponse.PageInfo.builder()
                .number(Math.max(page, 0))
                .size(Math.min(Math.max(size, 1), 100))
                .totalElements(0)
                .totalPages(0)
                .first(true)
                .last(true)
                .build();
    }

    private BigDecimal positiveMoney(BigDecimal value) {
        BigDecimal amount = money(value);
        if (amount.compareTo(ZERO) <= 0) {
            throw new BadRequestException("Le montant doit être strictement positif");
        }
        return amount;
    }

    private BigDecimal money(BigDecimal value) {
        return value == null ? ZERO : value.setScale(2, RoundingMode.HALF_UP);
    }

    private SensMouvementTresorerie inverse(SensMouvementTresorerie value) {
        return value == SensMouvementTresorerie.ENTREE
                ? SensMouvementTresorerie.SORTIE
                : SensMouvementTresorerie.ENTREE;
    }

    private Long id(CompteTresorerie account) {
        return account == null ? null : account.getId();
    }

    private String label(CompteTresorerie account) {
        return account == null ? null : account.getLibelle();
    }

    private String normalizeSearch(String value) {
        return value == null || value.isBlank() ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
