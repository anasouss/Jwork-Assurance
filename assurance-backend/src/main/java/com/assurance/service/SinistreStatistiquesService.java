package com.assurance.service;

import com.assurance.dto.response.SinistreStatistiquesResponse;
import com.assurance.enums.EtapeSuiviSinistre;
import com.assurance.enums.StatutSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.SinistreStatistiquesRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

@Service
@RequiredArgsConstructor
public class SinistreStatistiquesService {

    private static final EnumSet<StatutSinistre> OPEN = EnumSet.of(
            StatutSinistre.DECLARE, StatutSinistre.DOSSIER_INCOMPLET, StatutSinistre.TRANSMIS_COMPAGNIE,
            StatutSinistre.EXPERTISE, StatutSinistre.EN_ATTENTE_REGLEMENT, StatutSinistre.PARTIELLEMENT_REGLE,
            StatutSinistre.REGLE, StatutSinistre.ROUVERT
    );

    private final SinistreStatistiquesRepository repository;

    @Transactional(readOnly = true)
    public SinistreStatistiquesResponse get(Long agenceId, Integer annee) {
        LocalDate today = LocalDate.now();
        int year = annee == null ? today.getYear() : annee;
        if (year < 1900 || year > today.getYear()) {
            throw new BadRequestException("Sélectionnez une année de déclaration entre 1900 et " + today.getYear());
        }
        LocalDate start = LocalDate.of(year, 1, 1);
        LocalDate end = LocalDate.of(year, 12, 31);
        var years = new TreeSet<Integer>(Comparator.reverseOrder());
        years.add(today.getYear());
        years.add(year);
        years.addAll(repository.annees(agenceId));

        long declared = 0;
        long open = 0;
        long closed = 0;
        long rejected = 0;
        long overdue = 0;
        Map<String, Long> stages = new HashMap<>();
        for (var state : repository.etats(agenceId, start, end, today)) {
            declared += state.getNombre();
            if (OPEN.contains(state.getStatut())) {
                open += state.getNombre();
                overdue += state.getEnRetard();
            }
            if (state.getStatut() == StatutSinistre.CLOTURE) closed += state.getNombre();
            if (state.getStatut() == StatutSinistre.REJETE) rejected += state.getNombre();
            stages.merge(state.getEtape() == null ? "NON_RENSEIGNE" : state.getEtape().name(), state.getNombre(), Long::sum);
        }
        List<SinistreStatistiquesResponse.Repartition> byStage = new ArrayList<>();
        for (EtapeSuiviSinistre stage : EtapeSuiviSinistre.values()) {
            byStage.add(new SinistreStatistiquesResponse.Repartition(stage.name(), stageLabel(stage), stages.getOrDefault(stage.name(), 0L)));
        }
        if (stages.containsKey("NON_RENSEIGNE")) {
            byStage.add(new SinistreStatistiquesResponse.Repartition("NON_RENSEIGNE", "Non renseignée", stages.get("NON_RENSEIGNE")));
        }
        Map<Integer, Long> monthly = new HashMap<>();
        repository.mensuels(agenceId, start, end).forEach(row -> monthly.put(row.getMois(), row.getNombre()));
        List<SinistreStatistiquesResponse.Mois> evolution = new ArrayList<>();
        for (int month = 1; month <= 12; month++) {
            evolution.add(new SinistreStatistiquesResponse.Mois(month, monthly.getOrDefault(month, 0L)));
        }
        var delays = repository.delais(agenceId, start, end);
        BigDecimal averageDays = delays.isEmpty() ? null : BigDecimal.valueOf(delays.stream()
                .mapToLong(row -> ChronoUnit.DAYS.between(row.getDeclaration(), row.getCloture())).sum())
                .divide(BigDecimal.valueOf(delays.size()), 1, RoundingMode.HALF_UP);

        Map<Long, SinistreStatistiquesRepository.Finances> finances = new HashMap<>();
        repository.finances(agenceId, start, end).forEach(row -> finances.put(row.getCompagnieId(), row));
        Map<Long, BigDecimal> provisions = new HashMap<>();
        repository.provisions(agenceId, start, end, OPEN).forEach(row -> provisions.put(row.getCompagnieId(), row.getMontant()));
        var companies = repository.compagnies(agenceId, start, end).stream().map(row -> {
            var money = finances.get(row.getId());
            return new SinistreStatistiquesResponse.Compagnie(row.getId(), row.getLibelle(), row.getNombre(),
                    zero(provisions.get(row.getId())), money == null ? BigDecimal.ZERO : zero(money.getReglements()),
                    money == null ? BigDecimal.ZERO : zero(money.getRecours()), money == null ? BigDecimal.ZERO : zero(money.getFrais()));
        }).toList();
        var branches = repository.branches(agenceId, start, end).stream()
                .map(row -> new SinistreStatistiquesResponse.Repartition(row.getId() == null ? "NON_RENSEIGNE" : row.getId().toString(),
                        row.getLibelle() == null ? "Non renseignée" : row.getLibelle(), row.getNombre())).toList();
        return new SinistreStatistiquesResponse(year, today, List.copyOf(years), declared, open, closed, rejected, overdue,
                averageDays,
                companies.stream().map(SinistreStatistiquesResponse.Compagnie::provisions).reduce(BigDecimal.ZERO, BigDecimal::add),
                companies.stream().map(SinistreStatistiquesResponse.Compagnie::reglements).reduce(BigDecimal.ZERO, BigDecimal::add),
                companies.stream().map(SinistreStatistiquesResponse.Compagnie::recours).reduce(BigDecimal.ZERO, BigDecimal::add),
                companies.stream().map(SinistreStatistiquesResponse.Compagnie::frais).reduce(BigDecimal.ZERO, BigDecimal::add),
                evolution, byStage, branches, companies);
    }

    private BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String stageLabel(EtapeSuiviSinistre stage) {
        return switch (stage) {
            case OUVERTURE -> "Ouverture";
            case EXPERTISE_AVANT -> "Expertise avant";
            case INSTANCE_CLIENT -> "Instance client";
            case EXPERTISE_APRES -> "Expertise après";
            case COMPAGNIE -> "Compagnie";
            case CLOTURE -> "Clôturé";
        };
    }
}
