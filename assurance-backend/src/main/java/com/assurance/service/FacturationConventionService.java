package com.assurance.service;

import com.assurance.activity.ActivityAction;
import com.assurance.activity.BusinessActivityRecorder;
import com.assurance.activity.InvoiceActivity;
import com.assurance.dto.request.CreerFactureConventionRequest;
import com.assurance.dto.request.PropositionEcheanceFactureConventionRequest;
import com.assurance.dto.response.DocumentClientResponse;
import com.assurance.dto.response.EcheanceFacturationConventionPageResponse;
import com.assurance.dto.response.PropositionEcheanceDocumentClientResponse;
import com.assurance.dto.response.PreparationFactureConventionResponse;
import com.assurance.dto.response.ConventionInvoicePreviewResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.Client;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.EcheanceFacturationConvention;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.GroupeClient;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.Convention;
import com.assurance.enums.NatureElementFacturable;
import com.assurance.enums.ModeReglementConvention;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.entity.SequenceDocumentClient;
import com.assurance.enums.Fractionnement;
import com.assurance.enums.ModeFacturationContrat;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.StatutDocumentClient;
import com.assurance.enums.StatutEcheanceFacturationConvention;
import com.assurance.enums.StatutElementFacturable;
import com.assurance.enums.TypeDocumentClient;
import com.assurance.enums.TypePayeurPrime;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.DocumentClientRepository;
import com.assurance.repository.EcheanceFacturationConventionRepository;
import com.assurance.repository.ElementFacturableRepository;
import com.assurance.repository.LigneDocumentClientRepository;
import com.assurance.repository.SequenceDocumentClientRepository;
import com.assurance.repository.ConventionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class FacturationConventionService {

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final ContratRepository contratRepository;
    private final ContratClientRepository contratClientRepository;
    private final EcheanceFacturationConventionRepository echeanceRepository;
    private final ElementFacturableRepository elementRepository;
    private final LigneDocumentClientRepository lineRepository;
    private final DocumentClientRepository documentRepository;
    private final SequenceDocumentClientRepository sequenceRepository;
    private final AgenceRepository agenceRepository;
    private final DocumentClientService documentClientService;
    private final ConditionPaiementClientService conditionPaiementClientService;
    private final BusinessActivityRecorder businessActivityRecorder;
    private final ConventionRepository conventionRepository;
    private final ConventionBillingDetailsService billingDetails;

    @Transactional(readOnly = true)
    public List<ConventionOption> conventions(Long agenceId, int year) {
        if (year < 1900 || year > 2200) throw new BadRequestException("Annee de facturation invalide");
        return conventionRepository.findByAgenceIdAndActifTrueOrderByIntituleAsc(agenceId).stream()
                .map(item -> conventionOption(item, year))
                .toList();
    }

    private ConventionOption conventionOption(Convention item, int year) {
        Long compagnieId = item.getCompagnieAssurance() == null ? null : item.getCompagnieAssurance().getId();
        String compagnie = item.getCompagnieAssurance() == null ? null : item.getCompagnieAssurance().getNom();
        try {
            return new ConventionOption(item.getId(), item.getIntitule(), item.getFractionnement(),
                    ConventionBillingPeriods.cycle(item, year).stream()
                            .map(period -> new PeriodOption(period.number(), period.start(), period.end())).toList(), null, compagnieId, compagnie);
        } catch (BadRequestException exception) {
            return new ConventionOption(item.getId(), item.getIntitule(), item.getFractionnement(), List.of(), exception.getMessage(), compagnieId, compagnie);
        }
    }

    public record ConventionOption(Long id, String intitule, Fractionnement fractionnement, List<PeriodOption> periodes,
            String blocage, Long compagnieId, String compagnie) {
    }

    public record PeriodOption(int numero, LocalDate debut, LocalDate fin) {
    }

    @Transactional
    public PreparationFactureConventionResponse preparePeriod(Long agenceId, Long conventionId, int year, int periodNumber) {
        return preparePeriod(agenceId, conventionId, year, periodNumber, null, null, null);
    }

    @Transactional
    public PreparationFactureConventionResponse preparePeriod(Long agenceId, Long conventionId, int year, Integer periodNumber,
            Long compagnieId, com.assurance.enums.CategorieMouvementContrat categorieMouvement,
            com.assurance.enums.SensPrimeConvention sensPrime) {
        if (year < 1900 || year > 2200) throw new BadRequestException("Annee de facturation invalide");
        Convention convention = conventionRepository.findByAgenceIdAndId(agenceId, conventionId)
                .orElseThrow(() -> new ResourceNotFoundException("Convention", conventionId));
        if (!Boolean.TRUE.equals(convention.getActif())) throw new BadRequestException("Cette convention est inactive");
        if (compagnieId != null && (convention.getCompagnieAssurance() == null
                || !compagnieId.equals(convention.getCompagnieAssurance().getId()))) {
            throw new BadRequestException("La compagnie sélectionnée ne correspond pas à la convention");
        }
        if (categorieMouvement != null && !List.of(com.assurance.enums.CategorieMouvementContrat.AFFAIRE_NOUVELLE,
                com.assurance.enums.CategorieMouvementContrat.RENOUVELLEMENT,
                com.assurance.enums.CategorieMouvementContrat.AVENANT).contains(categorieMouvement)) {
            throw new BadRequestException("Mouvement de production invalide");
        }
        var periods = ConventionBillingPeriods.cycle(convention, year).stream()
                .filter(item -> periodNumber == null || item.number() == periodNumber).toList();
        if (periods.isEmpty()) throw new BadRequestException("Periode incompatible avec le fractionnement de la convention");
        synchronizeSchedules(agenceId, conventionId);
        List<EcheanceFacturationConvention> schedules = periods.stream().flatMap(period ->
                echeanceRepository.findPendingPeriod(agenceId, conventionId, period.start(), period.end()).stream()).toList();
        Set<Long> contractIds = schedules.stream().map(item -> item.getContrat().getId()).collect(Collectors.toSet());
        Map<Long, Client> subscribers = loadSubscribers(contractIds);
        Map<Long, List<ElementFacturable>> elements = loadElements(contractIds);
        Map<Long, List<EcheanceFacturationConvention>> allSchedules = contractIds.stream().collect(Collectors.toMap(
                Function.identity(), echeanceRepository::findByContratIdAndActifTrueOrderByNumeroPeriodeAsc));
        List<PreparationFactureConventionResponse.Ligne> rows = new ArrayList<>();
        for (EcheanceFacturationConvention schedule : schedules) {
            var sources = elements.getOrDefault(schedule.getContrat().getId(), List.of()).stream()
                    .filter(this::isBillable).filter(ConventionPaymentPolicy::isInvoice)
                    .filter(element -> matchesSource(element, schedule)).toList();
            long matched = sources.stream().filter(element -> matchesProductionFilter(element, categorieMouvement, sensPrime)).count();
            if ((categorieMouvement != null || sensPrime != null) && matched == 0) continue;
            Payer payer = resolvePayer(schedule.getContrat(), subscribers);
            List<ConventionInvoicePreviewResponse.Line> lines = new ArrayList<>();
            for (ElementFacturable element : sources) {
                BigDecimal amount = elementBulletin(element) == null ? null
                        : allocate(element, schedule, allSchedules.get(schedule.getContrat().getId())).ttc();
                lines.add(invoiceLine(element, schedule, amount));
            }
            String blocked = lines.isEmpty() ? "Aucune source facturable"
                    : lines.stream().anyMatch(line -> line.montantAPayer() == null) ? "Montant facturable manquant" : null;
            if (blocked == null) {
                try {
                    ConventionDocumentPolarity.direction(lines.stream().map(ConventionInvoicePreviewResponse.Line::montantAPayer).toList());
                } catch (BadRequestException exception) {
                    blocked = exception.getMessage();
                }
            }
            rows.add(new PreparationFactureConventionResponse.Ligne(schedule.getId(),
                    payer.group() == null ? payer.client().getId() : payer.group().getId(),
                    payer.group() == null ? "CLIENT" : "GROUPE", payer.name(), blocked, lines,
                    schedule.getPeriodeDebut(), schedule.getPeriodeFin(), matched > 0 && matched < sources.size()));
        }
        return new PreparationFactureConventionResponse(convention.getIntitule(), periods.get(0).start(), periods.get(periods.size() - 1).end(), rows);
    }

    private boolean matchesProductionFilter(ElementFacturable element,
            com.assurance.enums.CategorieMouvementContrat category, com.assurance.enums.SensPrimeConvention direction) {
        var movement = element.getMouvementContrat();
        if (category != null && (movement == null || movement.getTypeMouvement() == null
                || movement.getTypeMouvement().getCategorie() != category)) return false;
        if (direction == null) return true;
        if (element.getPrimeTotale() == null) return false;
        int sign = element.getPrimeTotale().signum();
        return switch (direction) {
            case PRIME_A_PAYER -> sign > 0;
            case RISTOURNE -> sign < 0;
            case SANS_INCIDENCE -> sign == 0;
        };
    }

    @Transactional(readOnly = true)
    public com.assurance.dto.response.ConventionInvoicePreviewResponse preview(Long agenceId, List<Long> requestedIds) {
        List<Long> ids = requestedIds.stream().filter(Objects::nonNull).distinct().toList();
        List<EcheanceFacturationConvention> selected = echeanceRepository.findSelected(agenceId, ids);
        if (selected.size() != ids.size()) throw new BadRequestException("Echeances introuvables");
        validateSelection(selected);
        Payer payer = resolveSinglePayer(selected);
        List<com.assurance.dto.response.ConventionInvoicePreviewResponse.Line> lines = new ArrayList<>();
        for (EcheanceFacturationConvention schedule : selected) {
            List<EcheanceFacturationConvention> schedules = echeanceRepository
                    .findByContratIdAndActifTrueOrderByNumeroPeriodeAsc(schedule.getContrat().getId());
            for (ElementFacturable element : loadElements(Set.of(schedule.getContrat().getId()))
                    .getOrDefault(schedule.getContrat().getId(), List.of())) {
                if (!matchesSource(element, schedule) || !isBillable(element)
                        || !ConventionPaymentPolicy.isInvoice(element)) continue;
                if (elementBulletin(element) == null) throw new BadRequestException("Montant facturable manquant pour le dossier "
                        + schedule.getContrat().getNumeroDossier());
                Amount amount = allocate(element, schedule, schedules);
                if (amount.ttc().signum() == 0) continue;
                lines.add(invoiceLine(element, schedule, amount.ttc()));
            }
        }
        ConventionDocumentPolarity.direction(lines.stream().map(ConventionInvoicePreviewResponse.Line::montantAPayer).toList());
        return new com.assurance.dto.response.ConventionInvoicePreviewResponse(selected.get(0).getContrat().getConvention().getIntitule(),
                payer.name(), selected.get(0).getPeriodeDebut(), selected.get(0).getPeriodeFin(),
                lines.stream().map(com.assurance.dto.response.ConventionInvoicePreviewResponse.Line::montantAPayer).reduce(ZERO, BigDecimal::add), lines);
    }

    private void validateSelection(List<EcheanceFacturationConvention> selected) {
        if (selected.isEmpty()) throw new BadRequestException("Selectionnez au moins une echeance");
        EcheanceFacturationConvention first = selected.get(0);
        if (selected.stream().anyMatch(item -> !Boolean.TRUE.equals(item.getActif())
                || item.getStatut() != StatutEcheanceFacturationConvention.A_FACTURER)) {
            throw new BadRequestException("Toutes les echeances doivent etre a facturer");
        }
        if (first.getContrat().getConvention() == null || selected.stream().anyMatch(item -> item.getContrat().getConvention() == null
                || !Objects.equals(first.getContrat().getConvention().getId(), item.getContrat().getConvention().getId())
                || !Objects.equals(first.getPeriodeDebut(), item.getPeriodeDebut())
                || !Objects.equals(first.getPeriodeFin(), item.getPeriodeFin()))) {
            throw new BadRequestException("Une facture doit concerner une seule convention et une seule periode");
        }
        if (selected.stream().anyMatch(item -> ConventionBillingPeriods.covering(item.getContrat().getConvention(),
                item.getPeriodeDebut(), item.getPeriodeDebut()).stream().noneMatch(period -> period.start().equals(item.getPeriodeDebut())
                        && period.end().equals(item.getPeriodeFin())))) {
            throw new BadRequestException("Le calendrier a change. Actualisez les echeances avant de facturer.");
        }
    }

    private ConventionBillingDetailsService.Details details(ElementFacturable element) {
        return billingDetails.details(element);
    }

    private ConventionInvoicePreviewResponse.Line invoiceLine(ElementFacturable element, EcheanceFacturationConvention schedule, BigDecimal amount) {
        var source = details(element);
        return new ConventionInvoicePreviewResponse.Line(source.numeroQuittance(), schedule.getContrat().getNumeroPolice(), companyName(element),
                element.getMouvementContrat() == null ? element.getLibelle() : billingDetails.movementLabel(element.getMouvementContrat()),
                source.assure(), source.vehicule(), element.getDateDebut() == null ? schedule.getContrat().getDateEffet() : element.getDateDebut(),
                element.getDateFin() == null ? schedule.getContrat().getDateEcheance() : element.getDateFin(), elementBulletin(element), amount);
    }

    private String companyName(ElementFacturable element) {
        var company = element.getCompagnieAssurance() == null ? element.getContrat().getCompagnieAssurance() : element.getCompagnieAssurance();
        return company == null ? null : company.getNom();
    }

    private boolean matchesSource(ElementFacturable element, EcheanceFacturationConvention schedule) {
        MouvementContrat movement = element.getMouvementContrat();
        Long sourceId = sourceMovementId(movement);
        return Objects.equals(sourceId, schedule.getMouvement() == null ? null : schedule.getMouvement().getId());
    }

    private Long sourceMovementId(MouvementContrat movement) {
        if (movement == null) return null;
        boolean amendment = ConventionPaymentPolicy.isAmendment(movement);
        return movement.getModeReglementConvention() != null || amendment ? movement.getId() : null;
    }

    BigDecimal elementBulletin(ElementFacturable element) {
        MouvementContrat movement = element.getMouvementContrat();
        if (ConventionPaymentPolicy.isAmendment(movement)) {
            return element.getPrimeTotale() == null ? null : money(element.getPrimeTotale());
        }
        BigDecimal total = movement != null && movement.getModeReglementConvention() != null
                ? movement.getMontantBulletin() : element.getContrat().getMontantBulletin();
        if (total == null || total.signum() <= 0) return null;
        // A bulletin belongs to a source movement, never to each assistance or vehicle independently.
        List<ElementFacturable> sources = loadElements(Set.of(element.getContrat().getId()))
                .getOrDefault(element.getContrat().getId(), List.of()).stream()
                .filter(this::isBillable).filter(ConventionPaymentPolicy::isInvoice)
                .filter(item -> item.getNature() != NatureElementFacturable.ASSISTANCE)
                .filter(item -> Objects.equals(item.getMouvementContrat() == null ? null : item.getMouvementContrat().getId(),
                        movement == null ? null : movement.getId()))
                .sorted(Comparator.comparing(ElementFacturable::getId)).toList();
        BigDecimal weight = sources.stream().map(item -> zero(item.getPrimeTotale()).abs()).reduce(ZERO, BigDecimal::add);
        if (weight.signum() == 0 || sources.isEmpty()) return null;
        BigDecimal allocated = ZERO;
        for (int index = 0; index < sources.size(); index++) {
            ElementFacturable item = sources.get(index);
            BigDecimal share = index == sources.size() - 1 ? total.subtract(allocated)
                    : total.multiply(zero(item.getPrimeTotale()).abs()).divide(weight, 2, RoundingMode.HALF_UP);
            if (Objects.equals(item.getId(), element.getId())) {
                BigDecimal signedPremium = movement == null || movement.getPrimeTotale() == null
                        ? element.getPrimeTotale() : movement.getPrimeTotale();
                return zero(signedPremium).signum() < 0 ? share.negate() : share;
            }
            allocated = allocated.add(share);
        }
        return null;
    }

    @Transactional(readOnly = true)
    public PropositionEcheanceDocumentClientResponse proposeDueDate(
            Long agenceId,
            PropositionEcheanceFactureConventionRequest request
    ) {
        List<Long> ids = request.getEcheanceIds().stream().filter(Objects::nonNull).distinct().toList();
        List<EcheanceFacturationConvention> selected = echeanceRepository.findSelected(agenceId, ids);
        if (selected.size() != ids.size()) {
            throw new BadRequestException("Une ou plusieurs échéances sont introuvables");
        }
        Payer payer = resolveSinglePayer(selected);
        validateSelection(selected);
        LocalDate emissionDate = LocalDate.now();
        if (preview(agenceId, ids).total().signum() < 0) {
            return PropositionEcheanceDocumentClientResponse.builder().dateEmission(emissionDate).build();
        }
        ConditionPaiementClientService.ResolvedCondition condition = conditionPaiementClientService.resolve(
                agenceId,
                payer.client(),
                payer.group(),
                emissionDate
        );
        return PropositionEcheanceDocumentClientResponse.builder()
                .dateEmission(emissionDate)
                .delaiJours(condition.days())
                .dateEcheanceProposee(condition.configured()
                        ? emissionDate.plusDays(condition.days())
                        : null)
                .origine(condition.origin())
                .conditionPaiementId(condition.conditionId())
                .dateFinCondition(condition.conditionEndDate())
                .justificatifPresent(condition.evidencePresent())
                .build();
    }

    @Transactional
    public EcheanceFacturationConventionPageResponse search(
            Long agenceId,
            StatutEcheanceFacturationConvention statut,
            LocalDate dateDu,
            LocalDate dateAu,
            Long compagnieId,
            Long conventionId,
            Long payeurId,
            String search,
            int page,
            int size
    ) {
        validatePeriod(dateDu, dateAu);
        synchronizeSchedules(agenceId);

        List<EcheanceFacturationConvention> schedules =
                echeanceRepository.findByAgenceIdAndActifTrueOrderByDateEcheanceAscIdAsc(agenceId);
        Map<Long, List<EcheanceFacturationConvention>> schedulesByContract = schedules.stream()
                .collect(Collectors.groupingBy(item -> item.getContrat().getId()));
        Map<Long, List<ElementFacturable>> elementsByContract = loadElements(schedulesByContract.keySet());
        Map<Long, Client> subscribers = loadSubscribers(schedulesByContract.keySet());
        Map<Long, IssuedAmount> issuedAmounts = loadIssuedAmounts(schedules);

        String normalizedSearch = normalizeSearch(search);
        List<EcheanceFacturationConventionPageResponse.Row> filtered = schedules.stream()
                .filter(item -> statut == null || item.getStatut() == statut)
                .filter(item -> dateDu == null || !item.getDateEcheance().isBefore(dateDu))
                .filter(item -> dateAu == null || !item.getDateEcheance().isAfter(dateAu))
                .filter(item -> compagnieId == null
                        || item.getContrat().getCompagnieAssurance() != null
                        && Objects.equals(item.getContrat().getCompagnieAssurance().getId(), compagnieId))
                .filter(item -> conventionId == null
                        || item.getContrat().getConvention() != null
                        && Objects.equals(item.getContrat().getConvention().getId(), conventionId))
                .map(item -> toRow(
                        item,
                        schedulesByContract.get(item.getContrat().getId()),
                        elementsByContract.getOrDefault(item.getContrat().getId(), List.of()),
                        schedulePayer(item, subscribers),
                        issuedAmounts.get(item.getId())
                ))
                .filter(row -> payeurId == null || Objects.equals(row.getPayeurId(), payeurId))
                .filter(row -> matches(row, normalizedSearch))
                .toList();

        int normalizedPage = Math.max(page, 0);
        int normalizedSize = Math.min(Math.max(size, 10), 100);
        int from = Math.min(normalizedPage * normalizedSize, filtered.size());
        int to = Math.min(from + normalizedSize, filtered.size());
        int totalPages = filtered.isEmpty() ? 0 : (filtered.size() + normalizedSize - 1) / normalizedSize;

        return EcheanceFacturationConventionPageResponse.builder()
                .summary(EcheanceFacturationConventionPageResponse.Summary.builder()
                        .total(filtered.size())
                        .aFacturer(filtered.stream()
                                .filter(row -> row.getStatut() == StatutEcheanceFacturationConvention.A_FACTURER)
                                .count())
                        .facturees(filtered.stream()
                                .filter(row -> row.getStatut() == StatutEcheanceFacturationConvention.FACTUREE)
                                .count())
                        .montantAFacturer(money(filtered.stream()
                                .filter(row -> row.getStatut() == StatutEcheanceFacturationConvention.A_FACTURER)
                                .map(EcheanceFacturationConventionPageResponse.Row::getMontantTtc)
                                .reduce(BigDecimal.ZERO, BigDecimal::add)))
                        .build())
                .page(EcheanceFacturationConventionPageResponse.PageInfo.builder()
                        .number(normalizedPage)
                        .size(normalizedSize)
                        .totalElements(filtered.size())
                        .totalPages(totalPages)
                        .first(normalizedPage == 0)
                        .last(totalPages == 0 || normalizedPage >= totalPages - 1)
                        .build())
                .rows(filtered.subList(from, to))
                .build();
    }

    @Transactional
    public DocumentClientResponse createInvoice(
            Long agenceId,
            CreerFactureConventionRequest request
    ) {
        return businessActivityRecorder.perform(() -> createInvoiceRecord(agenceId, request), result ->
                InvoiceActivity.command(documentClientService.findDocument(agenceId, result.getId()), Map.of(),
                        ActivityAction.ISSUED, result.getTotalDocument().signum() < 0
                                ? "Facture de ristourne émise" : "Facture de convention émise", "CONVENTION_INVOICE_ISSUANCE", List.of()));
    }

    private DocumentClientResponse createInvoiceRecord(Long agenceId, CreerFactureConventionRequest request) {
        Agence agence = agenceRepository.findByIdForUpdate(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        List<Long> ids = request.getEcheanceIds().stream().filter(Objects::nonNull).distinct().toList();
        List<EcheanceFacturationConvention> selected = echeanceRepository.findForUpdate(agenceId, ids);
        if (selected.size() != ids.size()) {
            throw new BadRequestException("Une ou plusieurs échéances sont introuvables");
        }
        if (selected.stream().anyMatch(item -> !Boolean.TRUE.equals(item.getActif())
                || item.getStatut() != StatutEcheanceFacturationConvention.A_FACTURER)) {
            throw new BadRequestException("Toutes les échéances sélectionnées doivent être à facturer");
        }

        Set<Long> contractIds = selected.stream().map(item -> item.getContrat().getId()).collect(Collectors.toSet());
        validateSelection(selected);
        synchronizeSchedules(agenceId, selected.get(0).getContrat().getConvention().getId());
        validateSelection(selected);
        Payer payer = resolveSinglePayer(selected);

        Map<Long, List<EcheanceFacturationConvention>> schedulesByContract = contractIds.stream()
                .collect(Collectors.toMap(
                        Function.identity(),
                        echeanceRepository::findByContratIdAndActifTrueOrderByNumeroPeriodeAsc
                ));
        Map<Long, List<ElementFacturable>> elementsByContract = loadElements(contractIds);
        var currentPreview = preview(agenceId, request.getEcheanceIds());
        if (request.getMontantAttendu() == null || currentPreview.total().compareTo(request.getMontantAttendu()) != 0) {
            throw new BadRequestException("Les montants ont change. Actualisez l'apercu avant de valider.");
        }
        boolean ristourne = ConventionDocumentPolarity.direction(currentPreview.lignes().stream()
                .map(ConventionInvoicePreviewResponse.Line::montantAPayer).toList()) < 0;
        validateIssuedBulletins(selected, schedulesByContract);
        List<InvoiceLineData> sourceLines = new ArrayList<>();
        for (EcheanceFacturationConvention schedule : selected) {
            for (ElementFacturable element : elementsByContract.getOrDefault(schedule.getContrat().getId(), List.of())) {
                Amount amount = allocate(element, schedule, schedulesByContract.get(schedule.getContrat().getId()));
                if (amount.ttc().signum() != 0) {
                    sourceLines.add(new InvoiceLineData(schedule, element, amount));
                }
            }
        }
        if (sourceLines.isEmpty()) {
            throw new BadRequestException("Les échéances sélectionnées ne contiennent aucun montant facturable");
        }

        LocalDate emissionDate = LocalDate.now();
        ConditionPaiementClientService.ResolvedCondition paymentCondition = ristourne ? null : conditionPaiementClientService.resolve(
                agenceId,
                payer.client(),
                payer.group(),
                emissionDate
        );
        LocalDate dueDate = null;
        if (ristourne && request.getDateEcheance() != null) {
            throw new BadRequestException("Une facture de ristourne ne porte pas d'échéance d'encaissement client");
        }
        if (!ristourne && paymentCondition.configured()) {
            dueDate = request.getDateEcheance() == null
                    ? emissionDate.plusDays(paymentCondition.days())
                    : request.getDateEcheance();
            validateInvoiceDueDate(dueDate, emissionDate, paymentCondition.days());
        } else if (request.getDateEcheance() != null) {
            throw new BadRequestException(
                    "Aucune condition de paiement active n'autorise une date d'échéance pour ce payeur"
            );
        }
        DocumentClient document = DocumentClient.builder()
                .agence(agence)
                .typeDocument(TypeDocumentClient.FACTURE)
                .statut(StatutDocumentClient.EMIS)
                .numero(nextNumber(agence, emissionDate.getYear()))
                .dateEmission(emissionDate)
                .periodeDebut(selected.stream().map(EcheanceFacturationConvention::getPeriodeDebut)
                        .min(LocalDate::compareTo).orElseThrow())
                .periodeFin(selected.stream().map(EcheanceFacturationConvention::getPeriodeFin)
                        .max(LocalDate::compareTo).orElseThrow())
                .dateEcheance(dueDate)
                .delaiPaiementJours(ristourne ? null : paymentCondition.days())
                .origineDelaiPaiement(ristourne ? null : paymentCondition.origin())
                .conditionPaiementClient(ristourne ? null : paymentCondition.condition())
                .clientPayeur(payer.client())
                .groupePayeur(payer.group())
                .payeurNom(payer.name())
                .payeurIdentifiant(payer.identifier())
                .payeurAdresse(payer.address())
                .totalDebit(ZERO)
                .totalCredit(ZERO)
                .totalDocument(ZERO)
                .notes(trimToNull(request.getNotes()))
                .conventionFacturee(selected.get(0).getContrat().getConvention().getIntitule())
                .conventionAdresse(selected.get(0).getContrat().getConvention().getAdresse())
                .conventionVille(selected.get(0).getContrat().getConvention().getVille() == null ? null
                        : selected.get(0).getContrat().getConvention().getVille().getNom())
                .build();

        BigDecimal debit = ZERO;
        BigDecimal credit = ZERO;
        int order = 1;
        for (InvoiceLineData data : sourceLines.stream()
                .sorted(Comparator.comparing((InvoiceLineData line) -> line.schedule().getPeriodeDebut())
                        .thenComparing(line -> line.element().getId()))
                .toList()) {
            BigDecimal lineDebit = data.amount().ttc().signum() > 0 ? data.amount().ttc() : ZERO;
            BigDecimal lineCredit = data.amount().ttc().signum() < 0 ? data.amount().ttc().abs() : ZERO;
            Contrat contract = data.schedule().getContrat();
            var details = details(data.element());
            LigneDocumentClient line = LigneDocumentClient.builder()
                    .document(document)
                    .elementFacturable(data.element())
                    .echeanceFacturationConvention(data.schedule())
                    .ordre(order++)
                    .dateOperation(data.element().getDateDebut() == null ? contract.getDateEffet() : data.element().getDateDebut())
                    .dateEcheance(data.element().getDateFin() == null ? contract.getDateEcheance() : data.element().getDateFin())
                    .numeroDossier(contract.getNumeroDossier())
                    .numeroPolice(contract.getNumeroPolice())
                    .numeroQuittance(details.numeroQuittance())
                    .assureConvention(details.assure())
                    .vehiculeConvention(details.vehicule())
                    .montantBulletinConvention(elementBulletin(data.element()))
                    .libelleDocument(conventionProductionLabel(contract, data.schedule().getPeriodeDebut()))
                    .mouvement(data.element().getMouvementContrat() == null ? data.element().getLibelle()
                            : billingDetails.movementLabel(data.element().getMouvementContrat()))
                    .compagnie(companyName(data.element()))
                    .debit(lineDebit)
                    .credit(lineCredit)
                    .primeNette(data.amount().net())
                    .taxes(data.amount().taxes())
                    .accessoires(data.amount().accessories())
                    .montantTtc(data.amount().ttc())
                    .build();
            document.getLignes().add(line);
            debit = debit.add(lineDebit);
            credit = credit.add(lineCredit);
        }
        document.setTotalDebit(money(debit));
        document.setTotalCredit(money(credit));
        document.setTotalDocument(money(debit.subtract(credit)));
        DocumentClient saved = documentRepository.saveAndFlush(document);
        selected.forEach(item -> {
            item.setStatut(StatutEcheanceFacturationConvention.FACTUREE);
            item.setDocumentClient(saved);
        });
        echeanceRepository.saveAll(selected);
        return documentClientService.detail(agenceId, saved.getId());
    }

    private void synchronizeSchedules(Long agenceId) {
        synchronizeSchedules(agenceId, null);
    }

    private void synchronizeSchedules(Long agenceId, Long conventionId) {
        agenceRepository.findByIdForUpdate(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        echeanceRepository.deactivateCancelledMovementSchedules(agenceId);
        for (Contrat contract : contratRepository.findConventionInvoiceContracts(agenceId)) {
            if (contract.getConvention() == null) continue;
            if (conventionId != null && !Objects.equals(contract.getConvention().getId(), conventionId)) continue;
            Fractionnement fractionnement = contract.getConvention().getFractionnement();
            List<Period> contractPeriods;
            List<ElementFacturable> insuranceSources = loadElements(Set.of(contract.getId())).getOrDefault(contract.getId(), List.of()).stream()
                    .filter(this::isBillable).filter(ConventionPaymentPolicy::isInvoice).toList();
            List<ElementFacturable> initialSources = insuranceSources.stream()
                    .filter(element -> sourceMovementId(element.getMouvementContrat()) == null).toList();
            try {
                LocalDate start = initialSources.stream().map(ElementFacturable::getDateDebut).filter(Objects::nonNull)
                        .min(LocalDate::compareTo).orElse(contract.getDateEffet());
                LocalDate end = initialSources.stream().map(ElementFacturable::getDateFin).filter(Objects::nonNull)
                        .max(LocalDate::compareTo).orElse(contract.getDateEcheance());
                contractPeriods = buildPeriods(start, end, contract.getConvention());
            } catch (BadRequestException exception) {
                continue;
            }
            Map<String, MouvementContrat> movements = contract.getMouvements().stream()
                    .filter(movement -> movement.getStatut() == StatutMouvementContrat.VALIDE)
                    .filter(movement -> insuranceSources.stream().anyMatch(element ->
                            Objects.equals(sourceMovementId(element.getMouvementContrat()), movement.getId())))
                    .filter(movement -> movement.getModeReglementConvention() == ModeReglementConvention.FACTURE
                            || movement.getModeReglementConvention() == null
                            && movement.getTypeMouvement().getCategorie() == com.assurance.enums.CategorieMouvementContrat.AVENANT
                            && ConventionPaymentPolicy.inheritedMode(contract) == ModeReglementConvention.FACTURE)
                    .sorted(Comparator.comparing(MouvementContrat::getId))
                    .collect(Collectors.toMap(movement -> "MOUVEMENT-" + movement.getId(), Function.identity(),
                            (first, second) -> first, java.util.LinkedHashMap::new));
            Map<String, List<Period>> expectedBySource = new java.util.LinkedHashMap<>();
            if (ConventionPaymentPolicy.inheritedMode(contract) == ModeReglementConvention.FACTURE && !initialSources.isEmpty()) {
                expectedBySource.put("CONTRAT", contractPeriods);
            }
            movements.forEach((source, movement) -> expectedBySource.put(source,
                    buildPeriods(movement.getDateEffet(), ConventionPaymentPolicy.isAmendment(movement)
                            ? movement.getDateEffet() : movement.getDateEcheance(), contract.getConvention())));
            Map<String, EcheanceFacturationConvention> existing = echeanceRepository
                    .findByContratIdOrderByNumeroPeriodeAsc(contract.getId()).stream()
                    .collect(Collectors.toMap(item -> item.getSourceKey() + ":" + periodKey(item), Function.identity()));
            Set<String> expectedKeys = expectedBySource.entrySet().stream()
                    .flatMap(entry -> entry.getValue().stream().map(period -> entry.getKey() + ":" + periodKey(period)))
                    .collect(Collectors.toSet());

            existing.values().stream()
                    .filter(item -> item.getStatut() == StatutEcheanceFacturationConvention.A_FACTURER)
                    .filter(item -> !expectedKeys.contains(item.getSourceKey() + ":" + periodKey(item)))
                    .forEach(item -> item.setActif(false));

            List<EcheanceFacturationConvention> toSave = new ArrayList<>(existing.values());
            for (Map.Entry<String, List<Period>> source : expectedBySource.entrySet()) {
                List<Period> expected = source.getValue();
                // An issued legacy period must never be recreated under overlapping new boundaries.
                boolean incompatibleIssued = existing.values().stream()
                        .filter(item -> Objects.equals(item.getSourceKey(), source.getKey()))
                        .anyMatch(item -> item.getDocumentClient() != null
                                && (expected.stream().noneMatch(period -> periodKey(period).equals(periodKey(item)))
                                    || !Objects.equals(item.getNombrePeriodes(), expected.size())));
                if (incompatibleIssued) {
                    throw new BadRequestException("Des factures historiques utilisent un autre calendrier pour le dossier "
                            + contract.getNumeroDossier() + ". Une regularisation est necessaire avant de refacturer.");
                }
                for (int index = 0; index < expected.size(); index++) {
                    Period period = expected.get(index);
                    EcheanceFacturationConvention item = existing.get(source.getKey() + ":" + periodKey(period));
                    if (item == null) {
                        item = EcheanceFacturationConvention.builder()
                                .agence(contract.getAgence())
                                .contrat(contract)
                                .mouvement(movements.get(source.getKey()))
                                .sourceKey(source.getKey())
                                .numeroPeriode(periodNumber(contract.getConvention(), period.start()))
                                .nombrePeriodes(expected.size())
                                .periodeDebut(period.start())
                                .periodeFin(period.end())
                                .dateEcheance(period.start())
                                .fractionnement(fractionnement)
                                .build();
                        toSave.add(item);
                    } else if (item.getStatut() == StatutEcheanceFacturationConvention.A_FACTURER) {
                        item.setActif(true);
                        item.setNumeroPeriode(periodNumber(contract.getConvention(), period.start()));
                        item.setNombrePeriodes(expected.size());
                        item.setFractionnement(fractionnement);
                    }
                }
            }
            echeanceRepository.saveAll(toSave);
        }
    }

    private void validateIssuedBulletins(List<EcheanceFacturationConvention> selected,
            Map<Long, List<EcheanceFacturationConvention>> schedulesByContract) {
        List<Long> issuedIds = selected.stream().flatMap(schedule -> schedulesByContract.get(schedule.getContrat().getId()).stream()
                        .filter(item -> Objects.equals(item.getSourceKey(), schedule.getSourceKey())))
                .filter(item -> item.getDocumentClient() != null).map(EcheanceFacturationConvention::getId).distinct().toList();
        if (issuedIds.isEmpty()) return;
        for (LigneDocumentClient line : lineRepository.findByEcheanceFacturationConventionIdIn(issuedIds)) {
            BigDecimal current = elementBulletin(line.getElementFacturable());
            if (current == null || line.getMontantBulletinConvention() == null
                    || current.compareTo(line.getMontantBulletinConvention()) != 0) {
                throw new BadRequestException("Le bulletin a deja ete facture en partie. Enregistrez une correction par avenant, sans modifier le bulletin initial.");
            }
        }
    }

    private List<Period> buildPeriods(LocalDate start, LocalDate end, Convention convention) {
        return ConventionBillingPeriods.covering(convention, start, end).stream()
                .map(period -> new Period(period.start(), period.end())).toList();
    }

    private int periodNumber(Convention convention, LocalDate start) {
        return ConventionBillingPeriods.covering(convention, start, start).get(0).number();
    }

    private String conventionProductionLabel(Contrat contract, LocalDate start) {
        var period = ConventionBillingPeriods.covering(contract.getConvention(), start, start).get(0);
        String frequency = switch (contract.getConvention().getFractionnement()) {
            case MENSUEL -> "Mois";
            case TRIMESTRIEL -> "Trimestre";
            case SEMESTRIEL -> "Semestre";
            case ANNUEL -> "Annee";
        };
        return "Production " + (contract.getBrancheAssurance() == null ? "convention" : contract.getBrancheAssurance().getLibelle())
                + " - " + frequency + " " + period.number() + " / " + period.year();
    }

    private EcheanceFacturationConventionPageResponse.Row toRow(
            EcheanceFacturationConvention item,
            List<EcheanceFacturationConvention> schedules,
            List<ElementFacturable> elements,
            Payer payer,
            IssuedAmount issuedAmount
    ) {
        Amount amount = issuedAmount == null
                ? elements.stream()
                    .map(element -> allocate(element, item, schedules))
                    .reduce(Amount.ZERO, Amount::add)
                : issuedAmount.amount();
        Contrat contract = item.getContrat();
        List<ElementFacturable> sourceElements = elements.stream().filter(this::isBillable)
                .filter(ConventionPaymentPolicy::isInvoice).filter(element -> matchesSource(element, item)).toList();
        boolean missingBulletin = sourceElements.isEmpty() || sourceElements.stream().anyMatch(element -> elementBulletin(element) == null);
        return EcheanceFacturationConventionPageResponse.Row.builder()
                .id(item.getId())
                .contratId(contract.getId())
                .mouvementId(item.getMouvement() == null ? null : item.getMouvement().getId())
                .numeroMouvement(item.getMouvement() == null ? null : item.getMouvement().getNumeroMouvement())
                .numeroBonCommande(ConventionPaymentPolicy.isAmendment(item.getMouvement()) ? null
                        : item.getMouvement() == null ? contract.getNumeroBonCommande() : item.getMouvement().getNumeroBonCommande())
                .documentId(item.getDocumentClient() == null ? null : item.getDocumentClient().getId())
                .payeurId(payer.group() == null ? payer.client().getId() : payer.group().getId())
                .payeurType(payer.group() == null ? "CLIENT" : "GROUPE")
                .payeurNom(payer.name())
                .numeroDossier(contract.getNumeroDossier())
                .numeroPolice(contract.getNumeroPolice())
                .compagnieId(contract.getCompagnieAssurance() == null ? null : contract.getCompagnieAssurance().getId())
                .compagnie(contract.getCompagnieAssurance() == null ? null : contract.getCompagnieAssurance().getNom())
                .conventionId(contract.getConvention() == null ? null : contract.getConvention().getId())
                .convention(item.getDocumentClient() != null && item.getDocumentClient().getConventionFacturee() != null
                        ? item.getDocumentClient().getConventionFacturee()
                        : contract.getConvention() == null ? null : contract.getConvention().getIntitule())
                .fractionnement(item.getFractionnement())
                .numeroPeriode(item.getNumeroPeriode())
                .nombrePeriodes(item.getNombrePeriodes())
                .periodeDebut(item.getPeriodeDebut())
                .periodeFin(item.getPeriodeFin())
                .dateEcheance(item.getDateEcheance())
                .statut(item.getStatut())
                .primeNette(amount.net())
                .taxes(amount.taxes())
                .accessoires(amount.accessories())
                .montantTtc(amount.ttc())
                .montantBulletin(issuedAmount != null ? issuedAmount.bulletin()
                        : missingBulletin ? null : sourceElements.stream().map(this::elementBulletin).reduce(ZERO, BigDecimal::add))
                .blocage(issuedAmount == null && missingBulletin ? "Source ou montant facturable manquant pour ce mouvement" : null)
                .build();
    }

    private Amount allocate(
            ElementFacturable element,
            EcheanceFacturationConvention target,
            List<EcheanceFacturationConvention> schedules
    ) {
        if (!isBillable(element) || !ConventionPaymentPolicy.isInvoice(element)
                || element.getNature() == NatureElementFacturable.ASSISTANCE) {
            return Amount.ZERO;
        }
        MouvementContrat movement = element.getMouvementContrat();
        Long sourceMovementId = sourceMovementId(movement);
        if (!Objects.equals(sourceMovementId, target.getMouvement() == null ? null : target.getMouvement().getId())) {
            return Amount.ZERO;
        }
        LocalDate sourceStart = element.getDateDebut() == null
                ? element.getContrat().getDateEffet()
                : element.getDateDebut();
        LocalDate sourceEnd = element.getDateFin() == null
                ? element.getContrat().getDateEcheance()
                : element.getDateFin();
        if (ConventionPaymentPolicy.isAmendment(movement)) {
            LocalDate effectiveDate = movement.getDateEffet() == null ? sourceStart : movement.getDateEffet();
            Period period = buildPeriods(effectiveDate, effectiveDate, element.getContrat().getConvention()).get(0);
            if (!period.start().equals(target.getPeriodeDebut()) || !period.end().equals(target.getPeriodeFin())) return Amount.ZERO;
            BigDecimal total = elementBulletin(element);
            if (total == null) return Amount.ZERO;
            return new Amount(money(element.getPrimeNette()), money(zero(element.getTaxe()).add(zero(element.getTaxeParafiscale()))),
                    money(zero(element.getAccessoire()).add(zero(element.getCnpac()))), total);
        }
        List<EcheanceFacturationConvention> overlaps = schedules.stream()
                .filter(item -> Objects.equals(item.getSourceKey(), target.getSourceKey()))
                .filter(item -> overlaps(sourceStart, sourceEnd, item.getPeriodeDebut(), item.getPeriodeFin()))
                .sorted(Comparator.comparing(EcheanceFacturationConvention::getPeriodeDebut))
                .toList();
        int index = overlaps.indexOf(target);
        if (index < 0) {
            return Amount.ZERO;
        }
        BigDecimal bulletin = elementBulletin(element);
        if (bulletin == null) return Amount.ZERO;
        Amount original = new Amount(
                money(element.getPrimeNette()),
                money(zero(element.getTaxe()).add(zero(element.getTaxeParafiscale()))),
                money(zero(element.getAccessoire()).add(zero(element.getCnpac()))),
                bulletin
        );
        Amount installment = original.divide(overlaps.size());
        if (index == overlaps.size() - 1) {
            Amount allocated = Amount.ZERO;
            for (int prior = 0; prior < index; prior++) {
                allocated = allocated.add(installment);
            }
            return original.subtract(allocated);
        }
        return installment;
    }

    private boolean isBillable(ElementFacturable element) {
        return Boolean.TRUE.equals(element.getActif())
                && (element.getMouvementContrat() == null || element.getMouvementContrat().getStatut() == StatutMouvementContrat.VALIDE)
                && element.getStatut() != StatutElementFacturable.BROUILLON
                && element.getStatut() != StatutElementFacturable.ANNULE;
    }

    private Map<Long, List<ElementFacturable>> loadElements(Set<Long> contractIds) {
        if (contractIds.isEmpty()) {
            return Map.of();
        }
        return elementRepository.findByContratIdInAndActifTrueOrderByDateDebutAscIdAsc(
                        new ArrayList<>(contractIds)).stream()
                .collect(Collectors.groupingBy(item -> item.getContrat().getId()));
    }

    private Map<Long, IssuedAmount> loadIssuedAmounts(List<EcheanceFacturationConvention> schedules) {
        List<Long> issuedIds = schedules.stream()
                .filter(item -> item.getStatut() == StatutEcheanceFacturationConvention.FACTUREE)
                .map(EcheanceFacturationConvention::getId)
                .toList();
        if (issuedIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, IssuedAmount> result = new HashMap<>();
        lineRepository.findByEcheanceFacturationConventionIdIn(issuedIds).stream()
                .collect(Collectors.groupingBy(line -> line.getEcheanceFacturationConvention().getId()))
                .forEach((id, lines) -> result.put(id, new IssuedAmount(
                        lines.stream().map(line -> new Amount(money(line.getPrimeNette()), money(line.getTaxes()),
                                money(line.getAccessoires()), money(line.getMontantTtc()))).reduce(Amount.ZERO, Amount::add),
                        lines.stream().anyMatch(line -> line.getMontantBulletinConvention() == null) ? null
                                : lines.stream().map(LigneDocumentClient::getMontantBulletinConvention).reduce(ZERO, BigDecimal::add))));
        return result;
    }

    private Map<Long, Client> loadSubscribers(Set<Long> contractIds) {
        if (contractIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, Client> result = new HashMap<>();
        for (ContratClient link : contratClientRepository.findByContratIdInAndRole(
                contractIds, RoleClientContrat.SOUSCRIPTEUR)) {
            Client current = result.get(link.getContrat().getId());
            if (current == null || Boolean.TRUE.equals(link.getPrincipalPourRole())) {
                result.put(link.getContrat().getId(), link.getClient());
            }
        }
        return result;
    }

    private Payer schedulePayer(EcheanceFacturationConvention schedule, Map<Long, Client> subscribers) {
        DocumentClient document = schedule.getDocumentClient();
        if (document == null) return resolvePayer(schedule.getContrat(), subscribers);
        return new Payer(document.getGroupePayeur() == null ? "C:" + document.getClientPayeur().getId()
                : "G:" + document.getGroupePayeur().getId(), document.getClientPayeur(), document.getGroupePayeur(),
                document.getPayeurNom(), document.getPayeurIdentifiant(), document.getPayeurAdresse());
    }

    private Payer resolvePayer(Contrat contract, Map<Long, Client> subscribers) {
        GroupeClient group = contract.getGroupeFacturation();
        boolean consolidated = group != null
                && (contract.getModeFacturation() == ModeFacturationContrat.CONSOLIDEE_GROUPE
                || contract.getTypePayeurPrime() == TypePayeurPrime.TRESORERIE_GROUPE);
        if (consolidated) {
            Client treasury = group.getClientTresorerie();
            return new Payer(
                    "G:" + group.getId(), treasury, group,
                    treasury == null ? group.getLibelle() : treasury.getNomAffichage(),
                    group.getCode(), treasury == null ? null : clientAddress(treasury)
            );
        }
        Client payer = contract.getPayeurPrime() == null
                ? subscribers.get(contract.getId())
                : contract.getPayeurPrime();
        if (payer == null) {
            throw new BadRequestException("Aucun payeur n'est défini pour le contrat " + contract.getNumeroDossier());
        }
        return new Payer(
                "C:" + payer.getId(), payer, null, payer.getNomAffichage(),
                firstNonBlank(payer.getCodeClient(), payer.getIce(), payer.getRc(), payer.getCin()),
                clientAddress(payer)
        );
    }

    private Payer resolveSinglePayer(List<EcheanceFacturationConvention> selected) {
        Set<Long> contractIds = selected.stream()
                .map(item -> item.getContrat().getId())
                .collect(Collectors.toSet());
        Map<Long, Client> subscribers = loadSubscribers(contractIds);
        List<Payer> payers = selected.stream()
                .map(item -> resolvePayer(item.getContrat(), subscribers))
                .toList();
        if (payers.isEmpty() || payers.stream().map(Payer::key).distinct().count() != 1) {
            throw new BadRequestException("Sélectionnez les lignes d'un même client ou groupe de facturation pour préparer une facture.");
        }
        return payers.get(0);
    }

    private void validateInvoiceDueDate(LocalDate dueDate, LocalDate emissionDate, int maximumDays) {
        if (dueDate.isBefore(emissionDate)) {
            throw new BadRequestException("La date d'échéance ne peut pas être antérieure à la date d'émission");
        }
        if (dueDate.isAfter(emissionDate.plusDays(maximumDays))) {
            throw new BadRequestException(
                    "La date d'échéance dépasse le délai de paiement applicable de " + maximumDays + " jours"
            );
        }
    }

    private String nextNumber(Agence agence, int year) {
        SequenceDocumentClient sequence = sequenceRepository
                .findForUpdate(agence.getId(), TypeDocumentClient.FACTURE, year)
                .orElseGet(() -> sequenceRepository.saveAndFlush(SequenceDocumentClient.builder()
                        .agence(agence)
                        .typeDocument(TypeDocumentClient.FACTURE)
                        .annee(year)
                        .prochaineValeur(1L)
                        .build()));
        long current = sequence.getProchaineValeur();
        sequence.setProchaineValeur(current + 1);
        sequenceRepository.save(sequence);
        return "FAC-%02d-%06d".formatted(year % 100, current);
    }

    private boolean matches(EcheanceFacturationConventionPageResponse.Row row, String search) {
        if (search == null) {
            return true;
        }
        return Stream.of(
                        row.getPayeurNom(), row.getNumeroDossier(), row.getNumeroPolice(),
                        row.getCompagnie(), row.getConvention()
                )
                .filter(Objects::nonNull)
                .map(value -> value.toLowerCase(Locale.ROOT))
                .anyMatch(value -> value.contains(search));
    }

    private boolean overlaps(LocalDate aStart, LocalDate aEnd, LocalDate bStart, LocalDate bEnd) {
        return !aStart.isAfter(bEnd) && !aEnd.isBefore(bStart);
    }

    private String periodKey(EcheanceFacturationConvention item) {
        return item.getPeriodeDebut() + ":" + item.getPeriodeFin();
    }

    private String periodKey(Period period) {
        return period.start() + ":" + period.end();
    }

    private BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal money(BigDecimal value) {
        return zero(value).setScale(2, RoundingMode.HALF_UP);
    }

    private void validatePeriod(LocalDate start, LocalDate end) {
        if (start != null && end != null && end.isBefore(start)) {
            throw new BadRequestException("La date de fin doit être postérieure ou égale à la date de début");
        }
    }

    private String normalizeSearch(String value) {
        String trimmed = trimToNull(value);
        return trimmed == null ? null : trimmed.toLowerCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String clientAddress(Client client) {
        String city = client.getVille() == null ? null : client.getVille().getNom();
        return client.getAdresse() == null
                ? city
                : city == null ? client.getAdresse() : client.getAdresse() + ", " + city;
    }

    private record Period(LocalDate start, LocalDate end) {
    }

    private record InvoiceLineData(
            EcheanceFacturationConvention schedule,
            ElementFacturable element,
            Amount amount
    ) {
    }

    private record Payer(
            String key,
            Client client,
            GroupeClient group,
            String name,
            String identifier,
            String address
    ) {
    }

    private record IssuedAmount(Amount amount, BigDecimal bulletin) {
    }

    private record Amount(BigDecimal net, BigDecimal taxes, BigDecimal accessories, BigDecimal ttc) {
        private static final Amount ZERO = new Amount(
                FacturationConventionService.ZERO,
                FacturationConventionService.ZERO,
                FacturationConventionService.ZERO,
                FacturationConventionService.ZERO
        );

        private Amount add(Amount other) {
            return new Amount(
                    net.add(other.net), taxes.add(other.taxes),
                    accessories.add(other.accessories), ttc.add(other.ttc)
            );
        }

        private Amount subtract(Amount other) {
            return new Amount(
                    net.subtract(other.net), taxes.subtract(other.taxes),
                    accessories.subtract(other.accessories), ttc.subtract(other.ttc)
            );
        }

        private Amount divide(int count) {
            BigDecimal divisor = BigDecimal.valueOf(count);
            return new Amount(
                    net.divide(divisor, 2, RoundingMode.HALF_UP),
                    taxes.divide(divisor, 2, RoundingMode.HALF_UP),
                    accessories.divide(divisor, 2, RoundingMode.HALF_UP),
                    ttc.divide(divisor, 2, RoundingMode.HALF_UP)
            );
        }
    }
}
