package com.assurance.service;

import com.assurance.dto.request.CreerFactureConventionRequest;
import com.assurance.dto.response.DocumentClientResponse;
import com.assurance.dto.response.EcheanceFacturationConventionPageResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.Client;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.EcheanceFacturationConvention;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.GroupeClient;
import com.assurance.entity.LigneDocumentClient;
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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
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
        Map<Long, Amount> issuedAmounts = loadIssuedAmounts(schedules);

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
                        resolvePayer(item.getContrat(), subscribers),
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
        Map<Long, Client> subscribers = loadSubscribers(contractIds);
        List<Payer> payers = selected.stream()
                .map(item -> resolvePayer(item.getContrat(), subscribers))
                .toList();
        if (payers.stream().map(Payer::key).distinct().count() != 1) {
            throw new BadRequestException("Les échéances sélectionnées doivent appartenir au même payeur");
        }

        Map<Long, List<EcheanceFacturationConvention>> schedulesByContract = contractIds.stream()
                .collect(Collectors.toMap(
                        Function.identity(),
                        echeanceRepository::findByContratIdAndActifTrueOrderByNumeroPeriodeAsc
                ));
        Map<Long, List<ElementFacturable>> elementsByContract = loadElements(contractIds);
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

        Agence agence = agenceRepository.findByIdForUpdate(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        LocalDate emissionDate = LocalDate.now();
        Payer payer = payers.get(0);
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
                .dateEcheance(request.getDateEcheance() == null
                        ? selected.stream().map(EcheanceFacturationConvention::getDateEcheance)
                        .max(LocalDate::compareTo).orElse(emissionDate)
                        : request.getDateEcheance())
                .clientPayeur(payer.client())
                .groupePayeur(payer.group())
                .payeurNom(payer.name())
                .payeurIdentifiant(payer.identifier())
                .payeurAdresse(payer.address())
                .totalDebit(ZERO)
                .totalCredit(ZERO)
                .totalDocument(ZERO)
                .notes(trimToNull(request.getNotes()))
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
            LigneDocumentClient line = LigneDocumentClient.builder()
                    .document(document)
                    .elementFacturable(data.element())
                    .echeanceFacturationConvention(data.schedule())
                    .ordre(order++)
                    .dateOperation(data.schedule().getPeriodeDebut())
                    .dateEcheance(data.schedule().getPeriodeFin())
                    .numeroDossier(contract.getNumeroDossier())
                    .numeroPolice(contract.getNumeroPolice())
                    .numeroQuittance("ECH-" + data.schedule().getId())
                    .mouvement(data.element().getLibelle())
                    .compagnie(data.element().getCompagnieAssurance() == null
                            ? contract.getCompagnieAssurance().getNom()
                            : data.element().getCompagnieAssurance().getNom())
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
        for (Contrat contract : contratRepository.findConventionInvoiceContracts(agenceId)) {
            Fractionnement fractionnement = contract.getFractionnement() == null
                    ? Fractionnement.ANNUEL
                    : contract.getFractionnement();
            List<Period> expected = buildPeriods(contract.getDateEffet(), contract.getDateEcheance(), fractionnement);
            Map<String, EcheanceFacturationConvention> existing = echeanceRepository
                    .findByContratIdAndActifTrueOrderByNumeroPeriodeAsc(contract.getId()).stream()
                    .collect(Collectors.toMap(this::periodKey, Function.identity()));
            Set<String> expectedKeys = expected.stream().map(this::periodKey).collect(Collectors.toSet());

            existing.values().stream()
                    .filter(item -> item.getStatut() == StatutEcheanceFacturationConvention.A_FACTURER)
                    .filter(item -> !expectedKeys.contains(periodKey(item)))
                    .forEach(item -> item.setActif(false));

            List<EcheanceFacturationConvention> toSave = new ArrayList<>(existing.values());
            for (int index = 0; index < expected.size(); index++) {
                Period period = expected.get(index);
                EcheanceFacturationConvention item = existing.get(periodKey(period));
                if (item == null) {
                    item = EcheanceFacturationConvention.builder()
                            .agence(contract.getAgence())
                            .contrat(contract)
                            .numeroPeriode(index + 1)
                            .nombrePeriodes(expected.size())
                            .periodeDebut(period.start())
                            .periodeFin(period.end())
                            .dateEcheance(period.start())
                            .fractionnement(fractionnement)
                            .build();
                    toSave.add(item);
                } else if (item.getStatut() == StatutEcheanceFacturationConvention.A_FACTURER) {
                    item.setNumeroPeriode(index + 1);
                    item.setNombrePeriodes(expected.size());
                    item.setFractionnement(fractionnement);
                }
            }
            echeanceRepository.saveAll(toSave);
        }
    }

    private List<Period> buildPeriods(LocalDate start, LocalDate end, Fractionnement fractionnement) {
        int months = switch (fractionnement) {
            case MENSUEL -> 1;
            case TRIMESTRIEL -> 3;
            case SEMESTRIEL -> 6;
            case ANNUEL -> 12;
        };
        List<Period> periods = new ArrayList<>();
        LocalDate cursor = start;
        while (!cursor.isAfter(end)) {
            LocalDate periodEnd = cursor.plusMonths(months).minusDays(1);
            if (periodEnd.isAfter(end)) {
                periodEnd = end;
            }
            periods.add(new Period(cursor, periodEnd));
            cursor = periodEnd.plusDays(1);
        }
        return periods;
    }

    private EcheanceFacturationConventionPageResponse.Row toRow(
            EcheanceFacturationConvention item,
            List<EcheanceFacturationConvention> schedules,
            List<ElementFacturable> elements,
            Payer payer,
            Amount issuedAmount
    ) {
        Amount amount = issuedAmount == null
                ? elements.stream()
                    .map(element -> allocate(element, item, schedules))
                    .reduce(Amount.ZERO, Amount::add)
                : issuedAmount;
        Contrat contract = item.getContrat();
        return EcheanceFacturationConventionPageResponse.Row.builder()
                .id(item.getId())
                .contratId(contract.getId())
                .documentId(item.getDocumentClient() == null ? null : item.getDocumentClient().getId())
                .payeurId(payer.group() == null ? payer.client().getId() : payer.group().getId())
                .payeurType(payer.group() == null ? "CLIENT" : "GROUPE")
                .payeurNom(payer.name())
                .numeroDossier(contract.getNumeroDossier())
                .numeroPolice(contract.getNumeroPolice())
                .compagnieId(contract.getCompagnieAssurance() == null ? null : contract.getCompagnieAssurance().getId())
                .compagnie(contract.getCompagnieAssurance() == null ? null : contract.getCompagnieAssurance().getNom())
                .conventionId(contract.getConvention() == null ? null : contract.getConvention().getId())
                .convention(contract.getConvention() == null ? null : contract.getConvention().getIntitule())
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
                .build();
    }

    private Amount allocate(
            ElementFacturable element,
            EcheanceFacturationConvention target,
            List<EcheanceFacturationConvention> schedules
    ) {
        if (!isBillable(element)) {
            return Amount.ZERO;
        }
        LocalDate sourceStart = element.getDateDebut() == null
                ? element.getContrat().getDateEffet()
                : element.getDateDebut();
        LocalDate sourceEnd = element.getDateFin() == null
                ? element.getContrat().getDateEcheance()
                : element.getDateFin();
        List<EcheanceFacturationConvention> overlaps = schedules.stream()
                .filter(item -> overlaps(sourceStart, sourceEnd, item.getPeriodeDebut(), item.getPeriodeFin()))
                .toList();
        int index = overlaps.indexOf(target);
        if (index < 0) {
            return Amount.ZERO;
        }
        Amount original = new Amount(
                money(element.getPrimeNette()),
                money(zero(element.getTaxe()).add(zero(element.getTaxeParafiscale()))),
                money(zero(element.getAccessoire()).add(zero(element.getCnpac()))),
                money(element.getPrimeTotale())
        );
        if (index == overlaps.size() - 1) {
            Amount allocated = Amount.ZERO;
            for (int prior = 0; prior < index; prior++) {
                allocated = allocated.add(proportional(original, sourceStart, sourceEnd, overlaps.get(prior)));
            }
            return original.subtract(allocated);
        }
        return proportional(original, sourceStart, sourceEnd, target);
    }

    private Amount proportional(
            Amount original,
            LocalDate sourceStart,
            LocalDate sourceEnd,
            EcheanceFacturationConvention schedule
    ) {
        LocalDate overlapStart = sourceStart.isAfter(schedule.getPeriodeDebut())
                ? sourceStart : schedule.getPeriodeDebut();
        LocalDate overlapEnd = sourceEnd.isBefore(schedule.getPeriodeFin())
                ? sourceEnd : schedule.getPeriodeFin();
        long totalDays = ChronoUnit.DAYS.between(sourceStart, sourceEnd) + 1;
        long overlapDays = ChronoUnit.DAYS.between(overlapStart, overlapEnd) + 1;
        BigDecimal ratio = BigDecimal.valueOf(overlapDays)
                .divide(BigDecimal.valueOf(totalDays), 12, RoundingMode.HALF_UP);
        return original.multiply(ratio);
    }

    private boolean isBillable(ElementFacturable element) {
        return Boolean.TRUE.equals(element.getActif())
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

    private Map<Long, Amount> loadIssuedAmounts(List<EcheanceFacturationConvention> schedules) {
        List<Long> issuedIds = schedules.stream()
                .filter(item -> item.getStatut() == StatutEcheanceFacturationConvention.FACTUREE)
                .map(EcheanceFacturationConvention::getId)
                .toList();
        if (issuedIds.isEmpty()) {
            return Map.of();
        }
        return lineRepository.findByEcheanceFacturationConventionIdIn(issuedIds).stream()
                .collect(Collectors.groupingBy(
                        line -> line.getEcheanceFacturationConvention().getId(),
                        Collectors.reducing(
                                Amount.ZERO,
                                line -> new Amount(
                                        money(line.getPrimeNette()),
                                        money(line.getTaxes()),
                                        money(line.getAccessoires()),
                                        money(line.getMontantTtc())
                                ),
                                Amount::add
                        )
                ));
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

        private Amount multiply(BigDecimal ratio) {
            return new Amount(
                    net.multiply(ratio).setScale(2, RoundingMode.HALF_UP),
                    taxes.multiply(ratio).setScale(2, RoundingMode.HALF_UP),
                    accessories.multiply(ratio).setScale(2, RoundingMode.HALF_UP),
                    ttc.multiply(ratio).setScale(2, RoundingMode.HALF_UP)
            );
        }
    }
}
