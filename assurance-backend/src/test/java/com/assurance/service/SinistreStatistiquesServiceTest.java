package com.assurance.service;

import com.assurance.enums.EtapeSuiviSinistre;
import com.assurance.enums.StatutSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.SinistreStatistiquesRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.projection.SpelAwareProxyProjectionFactory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class SinistreStatistiquesServiceTest {

    private final SinistreStatistiquesRepository repository = mock(SinistreStatistiquesRepository.class);
    private final SinistreStatistiquesService service = new SinistreStatistiquesService(repository);
    private final SpelAwareProxyProjectionFactory projections = new SpelAwareProxyProjectionFactory();

    @Test
    void emptyAgencyReturnsRealZerosAndNoInventedClosureDelay() {
        var data = service.get(7L, null);
        assertThat(data.annee()).isEqualTo(LocalDate.now().getYear());
        assertThat(data.anneesDisponibles()).contains(LocalDate.now().getYear());
        assertThat(data.declares()).isZero();
        assertThat(data.evolution()).hasSize(12).allMatch(row -> row.declarations() == 0);
        assertThat(data.parEtape()).hasSize(6).allMatch(row -> row.nombre() == 0);
        assertThat(data.delaiMoyenClotureJours()).isNull();
        assertThat(data.reglementsCumules()).isEqualByComparingTo(BigDecimal.ZERO);
        verify(repository).etats(eq(7L), any(), any(), any());
    }

    @Test
    void cohortTotalsIncludePaidButNotYetClosedClaimsAndExcludeRejectedOverdueActions() {
        int year = LocalDate.now().getYear() - 1;
        var start = LocalDate.of(year, 1, 1);
        var end = LocalDate.of(year, 12, 31);
        when(repository.etats(7L, start, end, LocalDate.now())).thenReturn(List.of(
                state(StatutSinistre.DECLARE, EtapeSuiviSinistre.OUVERTURE, 3, 1),
                state(StatutSinistre.REGLE, EtapeSuiviSinistre.COMPAGNIE, 2, 1),
                state(StatutSinistre.CLOTURE, EtapeSuiviSinistre.CLOTURE, 2, 2),
                state(StatutSinistre.REJETE, EtapeSuiviSinistre.COMPAGNIE, 1, 1)
        ));
        when(repository.mensuels(7L, start, end)).thenReturn(List.of(
                projections.createProjection(SinistreStatistiquesRepository.Mensuel.class, Map.of("mois", 1, "nombre", 3L)),
                projections.createProjection(SinistreStatistiquesRepository.Mensuel.class, Map.of("mois", 2, "nombre", 5L))
        ));
        when(repository.delais(7L, start, end)).thenReturn(List.of(
                projections.createProjection(SinistreStatistiquesRepository.Delai.class, Map.of("declaration", start, "cloture", start.plusDays(2))),
                projections.createProjection(SinistreStatistiquesRepository.Delai.class, Map.of("declaration", start, "cloture", start.plusDays(5)))
        ));
        when(repository.compagnies(7L, start, end)).thenReturn(List.of(
                projections.createProjection(SinistreStatistiquesRepository.Groupe.class, Map.of("id", 3L, "libelle", "Compagnie", "nombre", 8L))
        ));
        when(repository.finances(7L, start, end)).thenReturn(List.of(
                projections.createProjection(SinistreStatistiquesRepository.Finances.class,
                        Map.of("compagnieId", 3L, "reglements", new BigDecimal("1000.50"), "recours", new BigDecimal("100.25"), "frais", new BigDecimal("25.10")))
        ));
        when(repository.provisions(eq(7L), eq(start), eq(end), any())).thenReturn(List.of(
                projections.createProjection(SinistreStatistiquesRepository.Provisions.class, Map.of("compagnieId", 3L, "montant", new BigDecimal("250.75")))
        ));
        var data = service.get(7L, year);
        assertThat(data.declares()).isEqualTo(8);
        assertThat(data.ouverts()).isEqualTo(5);
        assertThat(data.clotures()).isEqualTo(2);
        assertThat(data.rejetes()).isEqualTo(1);
        assertThat(data.actionsEnRetard()).isEqualTo(2);
        assertThat(data.delaiMoyenClotureJours()).isEqualByComparingTo("3.5");
        assertThat(data.evolution().get(0).declarations()).isEqualTo(3);
        assertThat(data.evolution().get(2).declarations()).isZero();
        assertThat(data.parEtape()).filteredOn(row -> row.code().equals("COMPAGNIE"))
                .singleElement().satisfies(row -> assertThat(row.nombre()).isEqualTo(3));
        assertThat(data.provisionsOuvertes()).isEqualByComparingTo("250.75");
        assertThat(data.reglementsCumules()).isEqualByComparingTo("1000.50");
        assertThat(data.recoursCumules()).isEqualByComparingTo("100.25");
        assertThat(data.fraisCumules()).isEqualByComparingTo("25.10");
    }

    @Test
    void invalidYearIsRejectedBeforeAnyDataAccess() {
        assertThatThrownBy(() -> service.get(7L, LocalDate.now().getYear() + 1)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.get(7L, 1899)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(repository);
    }

    private SinistreStatistiquesRepository.Etat state(StatutSinistre status, EtapeSuiviSinistre stage, long count, long overdue) {
        return projections.createProjection(SinistreStatistiquesRepository.Etat.class,
                Map.of("statut", status, "etape", stage, "nombre", count, "enRetard", overdue));
    }
}
