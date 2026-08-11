package com.assurance.service;

import com.assurance.dto.response.PlatformDashboardResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.StatutAgence;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.UnauthorizedException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.QuittanceRepository;
import com.assurance.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PlatformDashboardService {

    private final AgenceRepository agenceRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final ContratRepository contratRepository;
    private final QuittanceRepository quittanceRepository;

    @Transactional(readOnly = true)
    public PlatformDashboardResponse get(Long userId, Long currentAgenceId, Long agenceId, LocalDate dateDu, LocalDate dateAu) {
        requirePlatformMode(userId, currentAgenceId);
        if (agenceId != null && !agenceRepository.existsById(agenceId)) {
            throw new BadRequestException("Agence introuvable");
        }

        LocalDate today = LocalDate.now();
        Map<Long, UserTotals> users = userMap(utilisateurRepository.countUsersByAgency(agenceId));
        Map<Long, PortfolioTotals> portfolios = portfolioMap(
                contratRepository.countPlatformPortfolioByAgency(agenceId, today, today.plusDays(30))
        );
        Map<Long, ProductionTotals> production = productionMap(
                quittanceRepository.sumPlatformProductionByAgency(agenceId, dateDu, dateAu)
        );

        List<Agence> selectedAgencies = agenceRepository.findAllByOrderByNomAsc().stream()
                .filter(agence -> agenceId == null || agence.getId().equals(agenceId))
                .toList();
        List<PlatformDashboardResponse.AgencyRow> rows = selectedAgencies.stream()
                .map(agence -> toRow(agence, users, portfolios, production))
                .toList();

        return PlatformDashboardResponse.builder()
                .dateDu(dateDu)
                .dateAu(dateAu)
                .agenceId(agenceId)
                .summary(summary(rows))
                .agencies(rows)
                .build();
    }

    private void requirePlatformMode(Long userId, Long currentAgenceId) {
        Utilisateur user = utilisateurRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("Utilisateur non authentifié"));
        boolean platformAdmin = user.getAgence() == null
                && "SUPER_ADMIN".equalsIgnoreCase(user.getRoleCode());
        if (!platformAdmin || currentAgenceId != null) {
            throw new UnauthorizedException("Retournez au contexte plateforme pour consulter cette vue");
        }
    }

    private PlatformDashboardResponse.AgencyRow toRow(
            Agence agence,
            Map<Long, UserTotals> users,
            Map<Long, PortfolioTotals> portfolios,
            Map<Long, ProductionTotals> production
    ) {
        UserTotals userTotals = users.getOrDefault(agence.getId(), UserTotals.empty());
        PortfolioTotals portfolio = portfolios.getOrDefault(agence.getId(), PortfolioTotals.empty());
        ProductionTotals totals = production.getOrDefault(agence.getId(), ProductionTotals.empty());
        return PlatformDashboardResponse.AgencyRow.builder()
                .id(agence.getId())
                .code(agence.getCode())
                .nom(agence.getNom())
                .ville(agence.getVille())
                .statut(agence.getStatut())
                .totalUsers(userTotals.total())
                .activeUsers(userTotals.active())
                .activeContracts(portfolio.active())
                .draftContracts(portfolio.drafts())
                .prospects(portfolio.prospects())
                .upcomingExpiries(portfolio.upcomingExpiries())
                .quittances(totals.quittances())
                .primeNette(totals.primeNette())
                .taxes(totals.taxes())
                .primeTotale(totals.primeTotale())
                .build();
    }

    private PlatformDashboardResponse.Summary summary(List<PlatformDashboardResponse.AgencyRow> rows) {
        return PlatformDashboardResponse.Summary.builder()
                .totalAgencies(agenceRepository.count())
                .activeAgencies(agenceRepository.countByStatut(StatutAgence.ACTIVE))
                .displayedAgencies(rows.size())
                .totalUsers(rows.stream().mapToLong(PlatformDashboardResponse.AgencyRow::getTotalUsers).sum())
                .activeUsers(rows.stream().mapToLong(PlatformDashboardResponse.AgencyRow::getActiveUsers).sum())
                .activeContracts(rows.stream().mapToLong(PlatformDashboardResponse.AgencyRow::getActiveContracts).sum())
                .draftContracts(rows.stream().mapToLong(PlatformDashboardResponse.AgencyRow::getDraftContracts).sum())
                .prospects(rows.stream().mapToLong(PlatformDashboardResponse.AgencyRow::getProspects).sum())
                .upcomingExpiries(rows.stream().mapToLong(PlatformDashboardResponse.AgencyRow::getUpcomingExpiries).sum())
                .quittances(rows.stream().mapToLong(PlatformDashboardResponse.AgencyRow::getQuittances).sum())
                .primeNette(sum(rows, PlatformDashboardResponse.AgencyRow::getPrimeNette))
                .taxes(sum(rows, PlatformDashboardResponse.AgencyRow::getTaxes))
                .primeTotale(sum(rows, PlatformDashboardResponse.AgencyRow::getPrimeTotale))
                .build();
    }

    private BigDecimal sum(
            List<PlatformDashboardResponse.AgencyRow> rows,
            java.util.function.Function<PlatformDashboardResponse.AgencyRow, BigDecimal> getter
    ) {
        return rows.stream().map(getter).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private Map<Long, UserTotals> userMap(List<Object[]> rows) {
        Map<Long, UserTotals> result = new HashMap<>();
        for (Object[] row : rows) {
            result.put(number(row[0]), new UserTotals(number(row[1]), number(row[2])));
        }
        return result;
    }

    private Map<Long, PortfolioTotals> portfolioMap(List<Object[]> rows) {
        Map<Long, PortfolioTotals> result = new HashMap<>();
        for (Object[] row : rows) {
            result.put(number(row[0]), new PortfolioTotals(
                    number(row[1]),
                    number(row[2]),
                    number(row[3]),
                    number(row[4])
            ));
        }
        return result;
    }

    private Map<Long, ProductionTotals> productionMap(List<Object[]> rows) {
        Map<Long, ProductionTotals> result = new HashMap<>();
        for (Object[] row : rows) {
            result.put(number(row[0]), new ProductionTotals(
                    decimal(row[1]),
                    decimal(row[2]),
                    decimal(row[3]),
                    number(row[4])
            ));
        }
        return result;
    }

    private long number(Object value) {
        return value instanceof Number number ? number.longValue() : Long.parseLong(String.valueOf(value));
    }

    private BigDecimal decimal(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value instanceof BigDecimal amount) {
            return amount;
        }
        return new BigDecimal(String.valueOf(value));
    }

    private record ProductionTotals(
            BigDecimal primeNette,
            BigDecimal taxes,
            BigDecimal primeTotale,
            long quittances
    ) {
        private static ProductionTotals empty() {
            return new ProductionTotals(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0L);
        }
    }

    private record UserTotals(long total, long active) {
        private static UserTotals empty() {
            return new UserTotals(0L, 0L);
        }
    }

    private record PortfolioTotals(long active, long drafts, long prospects, long upcomingExpiries) {
        private static PortfolioTotals empty() {
            return new PortfolioTotals(0L, 0L, 0L, 0L);
        }
    }
}
