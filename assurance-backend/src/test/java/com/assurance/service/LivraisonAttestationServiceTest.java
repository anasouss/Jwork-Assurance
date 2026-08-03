package com.assurance.service;

import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.LivraisonAttestation;
import com.assurance.enums.SourceLivraisonAttestation;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.AttestationStockRepository;
import com.assurance.repository.CompagnieAssuranceRepository;
import com.assurance.repository.GroupeUsageAttestationRepository;
import com.assurance.repository.LigneLivraisonAttestationRepository;
import com.assurance.repository.LivraisonAttestationRepository;
import com.assurance.repository.LotAttestationRepository;
import com.assurance.repository.MouvementStockAttestationRepository;
import com.assurance.repository.UsageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LivraisonAttestationServiceTest {

    @Mock private AgenceRepository agenceRepository;
    @Mock private CompagnieAssuranceRepository compagnieAssuranceRepository;
    @Mock private UsageRepository usageRepository;
    @Mock private GroupeUsageAttestationRepository groupeUsageAttestationRepository;
    @Mock private LivraisonAttestationRepository livraisonAttestationRepository;
    @Mock private LigneLivraisonAttestationRepository ligneLivraisonAttestationRepository;
    @Mock private LotAttestationRepository lotAttestationRepository;
    @Mock private AttestationStockRepository attestationStockRepository;
    @Mock private MouvementStockAttestationRepository mouvementStockAttestationRepository;
    @Mock private AttestationNumeroService attestationNumeroService;

    private LivraisonAttestationService service;

    @BeforeEach
    void setUp() {
        service = new LivraisonAttestationService(
                agenceRepository,
                compagnieAssuranceRepository,
                usageRepository,
                groupeUsageAttestationRepository,
                livraisonAttestationRepository,
                ligneLivraisonAttestationRepository,
                lotAttestationRepository,
                attestationStockRepository,
                mouvementStockAttestationRepository,
                attestationNumeroService
        );
    }

    @Test
    void listerFiltersDirectReceptionsByCompanyAndReceptionYear() {
        LivraisonAttestation livraison = LivraisonAttestation.builder()
                .compagnieAssurance(CompagnieAssurance.builder().nom("MATU").build())
                .source(SourceLivraisonAttestation.RECEPTION_DIRECTE)
                .dateReception(LocalDate.of(2026, 7, 15))
                .build();
        livraison.setId(20L);

        when(livraisonAttestationRepository.searchActive(
                1L,
                SourceLivraisonAttestation.RECEPTION_DIRECTE,
                4L,
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 12, 31)
        )).thenReturn(List.of(livraison));
        when(ligneLivraisonAttestationRepository.findByLivraisonAndActifTrue(livraison)).thenReturn(List.of());
        when(lotAttestationRepository.findByLivraisonAndActifTrue(livraison)).thenReturn(List.of());

        service.lister(1L, SourceLivraisonAttestation.RECEPTION_DIRECTE, 4L, 2026);

        verify(livraisonAttestationRepository).searchActive(
                1L,
                SourceLivraisonAttestation.RECEPTION_DIRECTE,
                4L,
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 12, 31)
        );
    }

    @Test
    void listerRejectsInvalidReceptionYear() {
        assertThatThrownBy(() -> service.lister(
                1L,
                SourceLivraisonAttestation.RECEPTION_DIRECTE,
                null,
                1800
        )).isInstanceOf(BadRequestException.class)
                .hasMessage("L'année de réception est invalide");
    }
}
