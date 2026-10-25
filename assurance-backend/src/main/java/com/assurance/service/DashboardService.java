package com.assurance.service;

import com.assurance.dto.response.AttestationStockDashboardResponse;
import com.assurance.dto.response.DashboardResponse;
import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.MouvementContrat;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.ClientRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.ElementFacturableRepository;
import com.assurance.repository.LigneQuittanceRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.QuittanceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final Locale FRENCH = Locale.FRENCH;
    private static final DateTimeFormatter PERIOD_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM");

    private final ContratRepository contratRepository;
    private final AssistanceContratRepository assistanceContratRepository;
    private final ClientRepository clientRepository;
    private final ElementFacturableRepository elementFacturableRepository;
    private final MouvementContratRepository mouvementContratRepository;
    private final QuittanceRepository quittanceRepository;
    private final LigneQuittanceRepository ligneQuittanceRepository;
    private final AttestationStockService attestationStockService;

    @Transactional(readOnly = true)
    public DashboardResponse get(Long agenceId, LocalDate dateDu, LocalDate dateAu) {
        QuittanceRepository.DashboardProductionTotals totals =
                quittanceRepository.sumDashboardProduction(agenceId, dateDu, dateAu);
        ElementFacturableRepository.DashboardAssistanceTotals assistanceTotals =
                elementFacturableRepository.sumDashboardAssistance(agenceId, dateDu, dateAu);
        AttestationStockDashboardResponse stock = attestationStockService.dashboard(agenceId);
        LocalDate today = LocalDate.now();

        return DashboardResponse.builder()
                .dateDu(dateDu)
                .dateAu(dateAu)
                .kpis(DashboardResponse.Kpis.builder()
                        .primeNette(valueOrZero(totals.getPrimeNette())
                                .add(valueOrZero(assistanceTotals.getPrimeNette())))
                        .taxes(valueOrZero(totals.getTaxe())
                                .add(valueOrZero(totals.getTaxeParafiscale()))
                                .add(valueOrZero(assistanceTotals.getTaxes())))
                        .primeTotale(valueOrZero(totals.getPrimeTotale())
                                .add(valueOrZero(assistanceTotals.getPrimeTotale())))
                        .quittances(totals.getQuittances() == null ? 0L : totals.getQuittances())
                        .mouvements(mouvementContratRepository.countByAgenceIdAndStatutAndDateEffetBetween(
                                agenceId, StatutMouvementContrat.VALIDE, dateDu, dateAu))
                        .contratsActifs(contratRepository.countActivePortfolioAt(agenceId, dateAu))
                        .assistancesActives(assistanceContratRepository.countActiveAt(agenceId, dateAu))
                        .assistancesProduites(assistanceTotals.getElementCount() == null
                                ? 0L : assistanceTotals.getElementCount())
                        .contratsBrouillon(contratRepository.countByAgenceIdAndProspectionFalseAndBrouillonTrue(agenceId))
                        .clientsActifs(clientRepository.countByAgenceIdAndActifTrue(agenceId))
                        .build())
                .workload(DashboardResponse.Workload.builder()
                        .echeances30Jours(contratRepository
                                .countByAgenceIdAndProspectionFalseAndBrouillonFalseAndStatutAndDateEcheanceBetween(
                                        agenceId, StatutContrat.ACTIVE, today, today.plusDays(30)))
                        .quittancesAAffecter(quittanceRepository.countDashboardUnassigned(agenceId))
                        .documentsAEmettre(quittanceRepository.countDashboardDocumentsToIssue(agenceId))
                        .alertesStock(stock.getStocksParCompagnieUsage().stream()
                                .filter(item -> Boolean.TRUE.equals(item.getStockFaible()))
                                .count())
                        .controleStockActif(stock.getControleStockActif())
                        .build())
                .productionMensuelle(monthlyProduction(agenceId, dateDu, dateAu))
                .portefeuilleParType(portfolioByType(agenceId, dateAu))
                .portefeuilleParBranche(portfolioByBranch(agenceId, dateAu))
                .productionParCategorie(productionByCategory(
                        agenceId,
                        dateDu,
                        dateAu,
                        valueOrZero(assistanceTotals.getPrimeTotale())
                ))
                .activitesRecentes(recentActivity(agenceId, dateDu, dateAu))
                .build();
    }

    private List<DashboardResponse.MonthlyProduction> monthlyProduction(
            Long agenceId,
            LocalDate dateDu,
            LocalDate dateAu
    ) {
        Map<YearMonth, BigDecimal> netByMonth = new LinkedHashMap<>();
        Map<YearMonth, BigDecimal> totalByMonth = new LinkedHashMap<>();
        Map<YearMonth, Long> countByMonth = new LinkedHashMap<>();
        for (Object[] row : quittanceRepository.sumDashboardProductionByMonth(agenceId, dateDu, dateAu)) {
            YearMonth month = YearMonth.of(integer(row[0]), integer(row[1]));
            netByMonth.merge(month, decimal(row[2]), BigDecimal::add);
            totalByMonth.merge(month, decimal(row[3]), BigDecimal::add);
            countByMonth.merge(month, number(row[4]), Long::sum);
        }
        for (Object[] row : elementFacturableRepository
                .sumDashboardAssistanceByMonth(agenceId, dateDu, dateAu)) {
            YearMonth month = YearMonth.of(integer(row[0]), integer(row[1]));
            netByMonth.merge(month, decimal(row[2]), BigDecimal::add);
            totalByMonth.merge(month, decimal(row[3]), BigDecimal::add);
        }

        List<DashboardResponse.MonthlyProduction> result = new ArrayList<>();
        YearMonth cursor = YearMonth.from(dateDu);
        YearMonth end = YearMonth.from(dateAu);
        while (!cursor.isAfter(end)) {
            result.add(DashboardResponse.MonthlyProduction.builder()
                    .annee(cursor.getYear())
                    .mois(cursor.getMonthValue())
                    .periode(cursor.format(PERIOD_FORMAT))
                    .primeNette(netByMonth.getOrDefault(cursor, BigDecimal.ZERO))
                    .primeTotale(totalByMonth.getOrDefault(cursor, BigDecimal.ZERO))
                    .quittances(countByMonth.getOrDefault(cursor, 0L))
                    .build());
            cursor = cursor.plusMonths(1);
        }
        return result;
    }

    private List<DashboardResponse.Breakdown> portfolioByType(Long agenceId, LocalDate dateReference) {
        return contratRepository.countActivePortfolioByTypeAt(agenceId, dateReference).stream()
                .map(row -> DashboardResponse.Breakdown.builder()
                        .code(String.valueOf(row[0]))
                        .libelle(contractTypeLabel(String.valueOf(row[0])))
                        .nombre(number(row[1]))
                        .montant(BigDecimal.ZERO)
                        .build())
                .toList();
    }

    private List<DashboardResponse.Breakdown> portfolioByBranch(Long agenceId, LocalDate dateReference) {
        return contratRepository.countActivePortfolioByBranchAt(agenceId, dateReference).stream()
                .map(row -> DashboardResponse.Breakdown.builder()
                        .code(String.valueOf(row[0]))
                        .libelle(String.valueOf(row[1]))
                        .nombre(number(row[2]))
                        .montant(BigDecimal.ZERO)
                        .build())
                .toList();
    }

    private List<DashboardResponse.Breakdown> productionByCategory(
            Long agenceId,
            LocalDate dateDu,
            LocalDate dateAu,
            BigDecimal assistanceTotal
    ) {
        List<DashboardResponse.Breakdown> rows = new ArrayList<>(
                ligneQuittanceRepository.sumDashboardByCategory(agenceId, dateDu, dateAu).stream()
                .map(row -> DashboardResponse.Breakdown.builder()
                        .code(String.valueOf(row[0]))
                        .libelle(categoryLabel(String.valueOf(row[0])))
                        .montant(decimal(row[1]))
                        .nombre(0L)
                        .build())
                .toList()
        );
        if (assistanceTotal.signum() != 0) {
            DashboardResponse.Breakdown existingAssistance = rows.stream()
                    .filter(row -> "ASSISTANCE".equalsIgnoreCase(row.getCode()))
                    .findFirst()
                    .orElse(null);
            if (existingAssistance == null) {
                rows.add(DashboardResponse.Breakdown.builder()
                        .code("ASSISTANCE")
                        .libelle("Assistance")
                        .montant(assistanceTotal)
                        .nombre(0L)
                        .build());
            } else {
                existingAssistance.setMontant(valueOrZero(existingAssistance.getMontant()).add(assistanceTotal));
            }
        }
        return rows;
    }

    private List<DashboardResponse.RecentActivity> recentActivity(
            Long agenceId,
            LocalDate dateDu,
            LocalDate dateAu
    ) {
        List<MouvementContrat> movements = mouvementContratRepository
                .findByAgenceIdAndStatutAndDateEffetBetweenOrderByCreatedAtDesc(
                        agenceId,
                        StatutMouvementContrat.VALIDE,
                        dateDu,
                        dateAu,
                        PageRequest.of(0, 6)
                )
                .getContent();
        if (movements.isEmpty()) {
            return List.of();
        }
        Map<Long, List<AssistanceContrat>> assistanceByMovement = assistanceContratRepository
                .findByMouvementContratIdInAndActifTrueOrderByCreatedAtDesc(
                        movements.stream().map(MouvementContrat::getId).toList()
                ).stream()
                .collect(Collectors.groupingBy(
                        assistance -> assistance.getMouvementContrat().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
        return movements.stream()
                .map(movement -> toRecentActivity(
                        movement,
                        assistanceByMovement.getOrDefault(movement.getId(), List.of())
                ))
                .toList();
    }

    private DashboardResponse.RecentActivity toRecentActivity(
            MouvementContrat movement,
            List<AssistanceContrat> assistances
    ) {
        boolean assistanceOnly = movement.getContrat().getBrancheAssurance() != null
                && "ASSISTANCE".equalsIgnoreCase(movement.getContrat().getBrancheAssurance().getCode());
        BigDecimal assistanceTotal = assistances.stream()
                .map(AssistanceContrat::getPrimeTotale)
                .map(this::valueOrZero)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        String assistanceCompanies = assistances.stream()
                .map(AssistanceContrat::getCompagnieAssistance)
                .filter(java.util.Objects::nonNull)
                .map(company -> company.getNom())
                .distinct()
                .collect(Collectors.joining(" · "));
        String assistanceProducts = assistances.stream()
                .map(assistance -> assistance.getProduitAssistance() == null
                        ? assistance.getProduit()
                        : assistance.getProduitAssistance().getLibelle())
                .filter(value -> value != null && !value.isBlank())
                .distinct()
                .collect(Collectors.joining(" · "));
        String insuranceCompany = movement.getContrat().getCompagnieAssurance() == null
                ? null : movement.getContrat().getCompagnieAssurance().getNom();
        String companies = assistanceOnly
                ? blankToNull(assistanceCompanies)
                : combineCompanies(insuranceCompany, assistanceCompanies);
        return DashboardResponse.RecentActivity.builder()
                .contratId(movement.getContrat().getId())
                .mouvementId(movement.getId())
                .numeroDossier(movement.getContrat().getNumeroDossier())
                .numeroPolice(movement.getContrat().getNumeroPolice())
                .typeContrat(movement.getContrat().getTypeContrat().name())
                .branche(movement.getContrat().getBrancheAssurance() == null
                        ? null : movement.getContrat().getBrancheAssurance().getLibelle())
                .mouvement(movement.getTypeMouvement().getLibelle())
                .detail(assistanceProducts.isBlank() ? null : assistanceProducts)
                .codeMouvement(movement.getTypeMouvement().getCode())
                .compagnie(companies)
                .dateEffet(movement.getDateEffet())
                .primeTotale(valueOrZero(movement.getPrimeTotale()).add(assistanceTotal))
                .build();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private String combineCompanies(String insuranceCompany, String assistanceCompanies) {
        String insurance = blankToNull(insuranceCompany);
        String assistance = blankToNull(assistanceCompanies);
        if (insurance == null) {
            return assistance;
        }
        if (assistance == null || insurance.equalsIgnoreCase(assistance)) {
            return insurance;
        }
        return insurance + " · " + assistance;
    }

    private String contractTypeLabel(String code) {
        return switch (code) {
            case "PARTICULIER" -> "Mono";
            case "CONVENTION" -> "Convention";
            case "FLOTTE" -> "Flotte";
            default -> code;
        };
    }

    private String categoryLabel(String code) {
        return switch (code) {
            case "AUTOMOBILE" -> "Automobile";
            case "CORPOREL" -> "Corporel";
            case "EVCAT" -> "EVCAT";
            default -> code.toLowerCase(FRENCH);
        };
    }

    private BigDecimal decimal(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value instanceof BigDecimal amount) {
            return amount;
        }
        if (value instanceof Number number) {
            return new BigDecimal(number.toString());
        }
        throw new IllegalArgumentException("Valeur numérique de tableau de bord invalide: " + value.getClass().getName());
    }

    private Long number(Object value) {
        return value instanceof Number number ? number.longValue() : Long.parseLong(String.valueOf(value));
    }

    private Integer integer(Object value) {
        return value instanceof Number number ? number.intValue() : Integer.parseInt(String.valueOf(value));
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
