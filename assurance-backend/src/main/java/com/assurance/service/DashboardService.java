package com.assurance.service;

import com.assurance.dto.response.AttestationStockDashboardResponse;
import com.assurance.dto.response.DashboardResponse;
import com.assurance.entity.MouvementContrat;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.repository.ClientRepository;
import com.assurance.repository.ContratRepository;
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

@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final Locale FRENCH = Locale.FRENCH;
    private static final DateTimeFormatter PERIOD_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM");

    private final ContratRepository contratRepository;
    private final ClientRepository clientRepository;
    private final MouvementContratRepository mouvementContratRepository;
    private final QuittanceRepository quittanceRepository;
    private final LigneQuittanceRepository ligneQuittanceRepository;
    private final AttestationStockService attestationStockService;

    @Transactional(readOnly = true)
    public DashboardResponse get(Long agenceId, LocalDate dateDu, LocalDate dateAu) {
        Object[] totals = quittanceRepository.sumDashboardProduction(agenceId, dateDu, dateAu);
        AttestationStockDashboardResponse stock = attestationStockService.dashboard(agenceId);
        LocalDate today = LocalDate.now();

        return DashboardResponse.builder()
                .dateDu(dateDu)
                .dateAu(dateAu)
                .kpis(DashboardResponse.Kpis.builder()
                        .primeNette(decimal(totals[0]))
                        .taxes(decimal(totals[1]).add(decimal(totals[2])))
                        .primeTotale(decimal(totals[5]))
                        .quittances(number(totals[6]))
                        .mouvements(mouvementContratRepository.countByAgenceIdAndStatutAndDateEffetBetween(
                                agenceId, StatutMouvementContrat.VALIDE, dateDu, dateAu))
                        .contratsActifs(contratRepository.countByAgenceIdAndProspectionFalseAndBrouillonFalseAndStatut(
                                agenceId, StatutContrat.ACTIVE))
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
                .portefeuilleParType(portfolioByType(agenceId))
                .productionParCategorie(productionByCategory(agenceId, dateDu, dateAu))
                .activitesRecentes(recentActivity(agenceId))
                .build();
    }

    private List<DashboardResponse.MonthlyProduction> monthlyProduction(
            Long agenceId,
            LocalDate dateDu,
            LocalDate dateAu
    ) {
        Map<YearMonth, Object[]> rows = new LinkedHashMap<>();
        for (Object[] row : quittanceRepository.sumDashboardProductionByMonth(agenceId, dateDu, dateAu)) {
            rows.put(YearMonth.of(integer(row[0]), integer(row[1])), row);
        }

        List<DashboardResponse.MonthlyProduction> result = new ArrayList<>();
        YearMonth cursor = YearMonth.from(dateDu);
        YearMonth end = YearMonth.from(dateAu);
        while (!cursor.isAfter(end)) {
            Object[] row = rows.get(cursor);
            result.add(DashboardResponse.MonthlyProduction.builder()
                    .annee(cursor.getYear())
                    .mois(cursor.getMonthValue())
                    .periode(cursor.format(PERIOD_FORMAT))
                    .primeNette(row == null ? BigDecimal.ZERO : decimal(row[2]))
                    .primeTotale(row == null ? BigDecimal.ZERO : decimal(row[3]))
                    .quittances(row == null ? 0L : number(row[4]))
                    .build());
            cursor = cursor.plusMonths(1);
        }
        return result;
    }

    private List<DashboardResponse.Breakdown> portfolioByType(Long agenceId) {
        return contratRepository.countActivePortfolioByType(agenceId).stream()
                .map(row -> DashboardResponse.Breakdown.builder()
                        .code(String.valueOf(row[0]))
                        .libelle(contractTypeLabel(String.valueOf(row[0])))
                        .nombre(number(row[1]))
                        .montant(BigDecimal.ZERO)
                        .build())
                .toList();
    }

    private List<DashboardResponse.Breakdown> productionByCategory(
            Long agenceId,
            LocalDate dateDu,
            LocalDate dateAu
    ) {
        return ligneQuittanceRepository.sumDashboardByCategory(agenceId, dateDu, dateAu).stream()
                .map(row -> DashboardResponse.Breakdown.builder()
                        .code(String.valueOf(row[0]))
                        .libelle(categoryLabel(String.valueOf(row[0])))
                        .montant(decimal(row[1]))
                        .nombre(0L)
                        .build())
                .toList();
    }

    private List<DashboardResponse.RecentActivity> recentActivity(Long agenceId) {
        return mouvementContratRepository
                .findByAgenceIdAndStatutOrderByCreatedAtDesc(
                        agenceId, StatutMouvementContrat.VALIDE, PageRequest.of(0, 6))
                .stream()
                .map(this::toRecentActivity)
                .toList();
    }

    private DashboardResponse.RecentActivity toRecentActivity(MouvementContrat movement) {
        return DashboardResponse.RecentActivity.builder()
                .contratId(movement.getContrat().getId())
                .mouvementId(movement.getId())
                .numeroDossier(movement.getContrat().getNumeroDossier())
                .numeroPolice(movement.getContrat().getNumeroPolice())
                .typeContrat(movement.getContrat().getTypeContrat().name())
                .mouvement(movement.getTypeMouvement().getLibelle())
                .codeMouvement(movement.getTypeMouvement().getCode())
                .compagnie(movement.getContrat().getCompagnieAssurance() == null
                        ? null
                        : movement.getContrat().getCompagnieAssurance().getNom())
                .dateEffet(movement.getDateEffet())
                .primeTotale(valueOrZero(movement.getPrimeTotale()))
                .build();
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
        return value instanceof BigDecimal amount ? amount : new BigDecimal(String.valueOf(value));
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
