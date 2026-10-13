package com.assurance.service;

import com.assurance.entity.ProduitAssistance;
import com.assurance.entity.TarifProduitAssistance;
import com.assurance.repository.TarifProduitAssistanceRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TarifProduitAssistanceServiceTest {

    @Mock
    private TarifProduitAssistanceRepository repository;

    @InjectMocks
    private TarifProduitAssistanceService service;

    @Test
    void doesNotReuseAnExpiredTariff() {
        ProduitAssistance produit = new ProduitAssistance();
        TarifProduitAssistance expired = TarifProduitAssistance.builder()
                .dateDebut(LocalDate.of(2025, 1, 1))
                .dateFin(LocalDate.of(2025, 12, 31))
                .actif(true)
                .build();
        LocalDate referenceDate = LocalDate.of(2026, 1, 1);
        when(repository.findByProduitAssistanceAndActifTrueAndDateDebutLessThanEqualOrderByDateDebutDescCreatedAtDesc(
                produit,
                referenceDate
        )).thenReturn(List.of(expired));

        assertThat(service.resolveTarifForDate(produit, referenceDate)).isNull();
    }
}
