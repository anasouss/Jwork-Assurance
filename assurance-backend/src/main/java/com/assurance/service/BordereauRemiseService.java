package com.assurance.service;

import com.assurance.dto.request.CreerBordereauRemiseRequest;
import com.assurance.dto.request.CreerTransfertTresorerieRequest;
import com.assurance.dto.request.DeposerBordereauRemiseRequest;
import com.assurance.dto.request.TraiterLigneBordereauRemiseRequest;
import com.assurance.dto.response.BordereauRemisePageResponse;
import com.assurance.dto.response.BordereauRemiseResponse;
import com.assurance.dto.response.InstrumentReglementPageResponse;
import com.assurance.dto.response.OperationTresorerieResponse;
import com.assurance.dto.response.SourceDocumentClientPageResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.BordereauRemise;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.LigneBordereauRemise;
import com.assurance.entity.SequenceBordereauRemise;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.StatutBordereauRemise;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutLigneBordereauRemise;
import com.assurance.enums.TypeBordereauRemise;
import com.assurance.enums.TypeCompteTresorerie;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.BordereauRemiseRepository;
import com.assurance.repository.InstrumentReglementClientRepository;
import com.assurance.repository.LigneBordereauRemiseRepository;
import com.assurance.repository.SequenceBordereauRemiseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class BordereauRemiseService {

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    private static final Set<StatutBordereauRemise> ACTIVE_STATUSES = Set.of(
            StatutBordereauRemise.BROUILLON,
            StatutBordereauRemise.DEPOSE,
            StatutBordereauRemise.PARTIELLEMENT_TRAITE
    );

    private final BordereauRemiseRepository bordereauRepository;
    private final LigneBordereauRemiseRepository lineRepository;
    private final SequenceBordereauRemiseRepository sequenceRepository;
    private final InstrumentReglementClientRepository instrumentRepository;
    private final AgenceRepository agenceRepository;
    private final TresorerieService tresorerieService;
    private final OperationTresorerieService operationTresorerieService;
    private final ReglementClientService reglementClientService;

    @Transactional(readOnly = true)
    public InstrumentReglementPageResponse eligibleInstruments(
            Long agenceId,
            TypeBordereauRemise type,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            int page,
            int size
    ) {
        if (type == TypeBordereauRemise.VERSEMENT_ESPECES) {
            throw new BadRequestException("Un versement d'espèces ne contient pas d'instruments");
        }
        validatePeriod(dateDu, dateAu);
        List<ModeReglementClient> modes = type == null
                ? List.of(ModeReglementClient.CHEQUE, ModeReglementClient.EFFET)
                : List.of(modeFor(type));
        Page<InstrumentReglementClient> result = instrumentRepository.searchEligibleForRemittance(
                agenceId,
                modes,
                dateDu,
                dateAu,
                normalizeSearch(search),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100))
        );
        return InstrumentReglementPageResponse.builder()
                .page(pageInfo(result))
                .rows(result.getContent().stream()
                        .map(reglementClientService::toInstrumentRegisterResponse)
                        .toList())
                .build();
    }

    @Transactional(readOnly = true)
    public BordereauRemisePageResponse search(
            Long agenceId,
            TypeBordereauRemise type,
            StatutBordereauRemise statut,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            int page,
            int size
    ) {
        validatePeriod(dateDu, dateAu);
        Page<BordereauRemise> result = bordereauRepository.search(
                agenceId,
                type,
                statut,
                dateDu,
                dateAu,
                normalizeSearch(search),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100))
        );
        return BordereauRemisePageResponse.builder()
                .page(pageInfo(result))
                .rows(result.getContent().stream().map(row -> toResponse(row, false)).toList())
                .build();
    }

    @Transactional(readOnly = true)
    public BordereauRemiseResponse detail(Long agenceId, Long id) {
        return toResponse(find(agenceId, id), true);
    }

    @Transactional
    public BordereauRemiseResponse create(Long agenceId, CreerBordereauRemiseRequest request) {
        CompteTresorerie destination = requireAccount(
                agenceId,
                request.getCompteDestinationId(),
                TypeCompteTresorerie.BANQUE
        );
        Agence agency = agenceRepository.findByIdForUpdate(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        BordereauRemise slip = BordereauRemise.builder()
                .agence(agency)
                .numero(nextNumber(agency, request.getType(), request.getDateBordereau().getYear()))
                .type(request.getType())
                .statut(StatutBordereauRemise.BROUILLON)
                .dateBordereau(request.getDateBordereau())
                .compteDestination(destination)
                .referenceBancaire(trimToNull(request.getReferenceBancaire()))
                .notes(trimToNull(request.getNotes()))
                .montantTotal(ZERO)
                .build();

        if (request.getType() == TypeBordereauRemise.VERSEMENT_ESPECES) {
            configureCashSlip(agenceId, slip, request);
        } else {
            configureInstrumentSlip(agenceId, slip, request);
        }
        return toResponse(bordereauRepository.saveAndFlush(slip), true);
    }

    @Transactional
    public BordereauRemiseResponse createCashDeposit(
            Long agenceId,
            CreerBordereauRemiseRequest request
    ) {
        if (request.getType() != TypeBordereauRemise.VERSEMENT_ESPECES) {
            throw new BadRequestException("Ce point d'entrée est réservé aux versements d'espèces");
        }
        BordereauRemiseResponse created = create(agenceId, request);
        DeposerBordereauRemiseRequest depositRequest = new DeposerBordereauRemiseRequest();
        depositRequest.setDateDepot(request.getDateBordereau());
        depositRequest.setReferenceBancaire(request.getReferenceBancaire());
        return deposit(agenceId, created.getId(), depositRequest);
    }

    @Transactional
    public BordereauRemiseResponse deposit(
            Long agenceId,
            Long id,
            DeposerBordereauRemiseRequest request
    ) {
        BordereauRemise slip = findForUpdate(agenceId, id);
        if (slip.getStatut() != StatutBordereauRemise.BROUILLON) {
            throw new BadRequestException("Seul un bordereau brouillon peut être déposé");
        }
        if (request.getDateDepot().isBefore(slip.getDateBordereau())) {
            throw new BadRequestException("La date de dépôt ne peut pas précéder la date du bordereau");
        }
        slip.setDateDepot(request.getDateDepot());
        if (request.getReferenceBancaire() != null) {
            slip.setReferenceBancaire(trimToNull(request.getReferenceBancaire()));
        }
        if (slip.getType() == TypeBordereauRemise.VERSEMENT_ESPECES) {
            depositCash(agenceId, slip);
        } else {
            if (slip.getLignes().isEmpty()) {
                throw new BadRequestException("Le bordereau ne contient aucun instrument");
            }
            slip.getLignes().forEach(line -> {
                reglementClientService.markInstrumentRemitted(
                        agenceId,
                        line.getInstrument().getId(),
                        slip.getCompteDestination().getId(),
                        request.getDateDepot()
                );
                line.setStatut(StatutLigneBordereauRemise.REMISE);
                line.setDateTraitement(request.getDateDepot());
            });
            slip.setStatut(StatutBordereauRemise.DEPOSE);
        }
        return toResponse(bordereauRepository.saveAndFlush(slip), true);
    }

    @Transactional
    public BordereauRemiseResponse settleLine(
            Long agenceId,
            Long bordereauId,
            Long lineId,
            TraiterLigneBordereauRemiseRequest request
    ) {
        BordereauRemise slip = requireDeposited(findForUpdate(agenceId, bordereauId));
        LigneBordereauRemise line = findLine(slip, lineId);
        requireRemittedLine(line);
        requireOperationAfterDeposit(slip, request.getDateOperation());
        reglementClientService.confirmInstrumentFromRemittance(
                agenceId,
                line.getInstrument().getId(),
                slip.getCompteDestination().getId(),
                request.getDateOperation()
        );
        return toResponse(findForUpdate(agenceId, bordereauId), true);
    }

    @Transactional
    public BordereauRemiseResponse rejectLine(
            Long agenceId,
            Long bordereauId,
            Long lineId,
            TraiterLigneBordereauRemiseRequest request
    ) {
        if (request.getMotif() == null || request.getMotif().isBlank()) {
            throw new BadRequestException("Le motif du rejet est obligatoire");
        }
        BordereauRemise slip = requireDeposited(findForUpdate(agenceId, bordereauId));
        LigneBordereauRemise line = findLine(slip, lineId);
        requireRemittedLine(line);
        requireOperationAfterDeposit(slip, request.getDateOperation());
        reglementClientService.rejectInstrumentFromRemittance(
                agenceId,
                line.getInstrument().getId(),
                request.getMotif(),
                request.getDateOperation()
        );
        return toResponse(findForUpdate(agenceId, bordereauId), true);
    }

    @Transactional
    public BordereauRemiseResponse cancel(Long agenceId, Long id) {
        BordereauRemise slip = findForUpdate(agenceId, id);
        if (slip.getStatut() != StatutBordereauRemise.BROUILLON) {
            throw new BadRequestException("Seul un bordereau brouillon peut être annulé");
        }
        slip.setStatut(StatutBordereauRemise.ANNULE);
        return toResponse(bordereauRepository.saveAndFlush(slip), true);
    }

    private void configureCashSlip(
            Long agenceId,
            BordereauRemise slip,
            CreerBordereauRemiseRequest request
    ) {
        if (request.getCompteSourceId() == null || request.getMontantEspeces() == null) {
            throw new BadRequestException("La caisse source et le montant sont obligatoires");
        }
        if (request.getInstrumentIds() != null && !request.getInstrumentIds().isEmpty()) {
            throw new BadRequestException("Un versement d'espèces ne contient pas d'instruments");
        }
        CompteTresorerie source = requireAccount(
                agenceId,
                request.getCompteSourceId(),
                TypeCompteTresorerie.CAISSE
        );
        if (!source.getDevise().equals(slip.getCompteDestination().getDevise())) {
            throw new BadRequestException("Les comptes source et destination doivent avoir la même devise");
        }
        slip.setCompteSource(source);
        slip.setMontantTotal(positiveMoney(request.getMontantEspeces()));
    }

    private void configureInstrumentSlip(
            Long agenceId,
            BordereauRemise slip,
            CreerBordereauRemiseRequest request
    ) {
        List<Long> ids = request.getInstrumentIds() == null
                ? List.of()
                : new ArrayList<>(new LinkedHashSet<>(request.getInstrumentIds()));
        if (ids.isEmpty()) {
            throw new BadRequestException("Sélectionnez au moins un instrument");
        }
        ids.sort(Long::compareTo);
        List<InstrumentReglementClient> instruments = instrumentRepository
                .findAllByAgenceIdAndIdInForUpdate(agenceId, ids);
        if (instruments.size() != ids.size()) {
            throw new BadRequestException("Un instrument sélectionné est introuvable");
        }
        if (lineRepository.existsActiveByInstrumentIds(ids, ACTIVE_STATUSES)) {
            throw new BadRequestException("Un instrument appartient déjà à un bordereau actif");
        }
        ModeReglementClient expectedMode = modeFor(request.getType());
        BigDecimal total = ZERO;
        for (InstrumentReglementClient instrument : instruments) {
            if (instrument.getStatut() != StatutInstrumentReglement.EN_ATTENTE
                    || instrument.getMode() != expectedMode) {
                throw new BadRequestException("Tous les instruments doivent être en attente et du même type");
            }
            LigneBordereauRemise line = LigneBordereauRemise.builder()
                    .bordereau(slip)
                    .instrument(instrument)
                    .montant(money(instrument.getMontant()))
                    .statut(StatutLigneBordereauRemise.PREPAREE)
                    .build();
            slip.getLignes().add(line);
            total = total.add(line.getMontant());
        }
        slip.setMontantTotal(total);
    }

    private void depositCash(Long agenceId, BordereauRemise slip) {
        CreerTransfertTresorerieRequest transfer = new CreerTransfertTresorerieRequest();
        transfer.setCompteSourceId(slip.getCompteSource().getId());
        transfer.setCompteDestinationId(slip.getCompteDestination().getId());
        transfer.setMontant(slip.getMontantTotal());
        transfer.setDateOperation(slip.getDateDepot());
        transfer.setDateValeur(slip.getDateDepot());
        transfer.setReference(slip.getReferenceBancaire());
        transfer.setMotif("Versement espèces " + slip.getNumero());
        OperationTresorerieResponse operation = operationTresorerieService.createTransfer(
                agenceId,
                transfer
        );
        slip.setOperationTresorerieId(operation.getId());
        slip.setStatut(StatutBordereauRemise.CLOTURE);
    }

    private CompteTresorerie requireAccount(Long agenceId, Long id, TypeCompteTresorerie type) {
        CompteTresorerie account = tresorerieService.findAccount(agenceId, id);
        if (account.getTypeCompte() != type || !Boolean.TRUE.equals(account.getActif())) {
            throw new BadRequestException("Le compte de trésorerie sélectionné est invalide ou inactif");
        }
        return account;
    }

    private BordereauRemise find(Long agenceId, Long id) {
        return bordereauRepository.findByIdAndAgenceId(id, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Bordereau de remise", id));
    }

    private BordereauRemise findForUpdate(Long agenceId, Long id) {
        return bordereauRepository.findByIdAndAgenceIdForUpdate(id, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Bordereau de remise", id));
    }

    private BordereauRemise requireDeposited(BordereauRemise slip) {
        if (slip.getStatut() != StatutBordereauRemise.DEPOSE
                && slip.getStatut() != StatutBordereauRemise.PARTIELLEMENT_TRAITE) {
            throw new BadRequestException("Le bordereau doit être déposé avant son traitement");
        }
        return slip;
    }

    private LigneBordereauRemise findLine(BordereauRemise slip, Long lineId) {
        return slip.getLignes().stream()
                .filter(line -> line.getId().equals(lineId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Ligne de bordereau", lineId));
    }

    private void requireRemittedLine(LigneBordereauRemise line) {
        if (line.getStatut() != StatutLigneBordereauRemise.REMISE) {
            throw new BadRequestException("Cette ligne a déjà été traitée");
        }
    }

    private void requireOperationAfterDeposit(BordereauRemise slip, LocalDate operationDate) {
        if (slip.getDateDepot() != null && operationDate.isBefore(slip.getDateDepot())) {
            throw new BadRequestException("La date d'opération ne peut pas précéder le dépôt");
        }
    }

    private ModeReglementClient modeFor(TypeBordereauRemise type) {
        if (type == TypeBordereauRemise.CHEQUE) {
            return ModeReglementClient.CHEQUE;
        }
        if (type == TypeBordereauRemise.EFFET) {
            return ModeReglementClient.EFFET;
        }
        throw new BadRequestException("Ce type de bordereau ne contient pas d'instruments");
    }

    private String nextNumber(Agence agency, TypeBordereauRemise type, int year) {
        SequenceBordereauRemise sequence = sequenceRepository
                .findByAgenceIdAndTypeAndAnnee(agency.getId(), type, year)
                .orElseGet(() -> SequenceBordereauRemise.builder()
                        .agence(agency)
                        .type(type)
                        .annee(year)
                        .valeur(0L)
                        .build());
        sequence.setValeur(sequence.getValeur() + 1);
        sequenceRepository.save(sequence);
        String prefix = switch (type) {
            case CHEQUE -> "BRC";
            case EFFET -> "BRE";
            case VERSEMENT_ESPECES -> "BRV";
        };
        return String.format(Locale.ROOT, "%s-%d-%06d", prefix, year, sequence.getValeur());
    }

    private BordereauRemiseResponse toResponse(BordereauRemise slip, boolean includeLines) {
        List<BordereauRemiseResponse.Ligne> lines = includeLines
                ? slip.getLignes().stream().map(this::toLineResponse).toList()
                : List.of();
        return BordereauRemiseResponse.builder()
                .id(slip.getId())
                .numero(slip.getNumero())
                .type(slip.getType())
                .statut(slip.getStatut())
                .dateBordereau(slip.getDateBordereau())
                .dateDepot(slip.getDateDepot())
                .compteDestinationId(slip.getCompteDestination().getId())
                .compteDestination(slip.getCompteDestination().getLibelle())
                .compteSourceId(slip.getCompteSource() == null ? null : slip.getCompteSource().getId())
                .compteSource(slip.getCompteSource() == null ? null : slip.getCompteSource().getLibelle())
                .montantTotal(slip.getMontantTotal())
                .referenceBancaire(slip.getReferenceBancaire())
                .notes(slip.getNotes())
                .operationTresorerieId(slip.getOperationTresorerieId())
                .nombreLignes(slip.getLignes().size())
                .createdAt(slip.getCreatedAt())
                .lignes(lines)
                .build();
    }

    private BordereauRemiseResponse.Ligne toLineResponse(LigneBordereauRemise line) {
        InstrumentReglementClient instrument = line.getInstrument();
        return BordereauRemiseResponse.Ligne.builder()
                .id(line.getId())
                .instrumentId(instrument.getId())
                .reglementId(instrument.getReglement().getId())
                .numeroReglement(instrument.getReglement().getNumero())
                .payeur(instrument.getReglement().getPayeurNom())
                .mode(instrument.getMode())
                .referenceInstrument(instrument.getReferenceInstrument())
                .banqueEmettrice(instrument.getBanqueEmettrice())
                .dateReception(instrument.getDateInstrument())
                .dateEcheance(instrument.getDateEcheance())
                .montant(line.getMontant())
                .statut(line.getStatut())
                .dateTraitement(line.getDateTraitement())
                .motifRejet(line.getMotifRejet())
                .build();
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

    private void validatePeriod(LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new BadRequestException("La date de début doit précéder la date de fin");
        }
    }

    private BigDecimal positiveMoney(BigDecimal value) {
        BigDecimal amount = money(value);
        if (amount.signum() <= 0) {
            throw new BadRequestException("Le montant doit être strictement positif");
        }
        return amount;
    }

    private BigDecimal money(BigDecimal value) {
        return value == null ? ZERO : value.setScale(2, RoundingMode.HALF_UP);
    }

    private String normalizeSearch(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
