package com.assurance.service;

import com.assurance.dto.response.PagedResponse;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.Contrat;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.VehiculeRepository;
import com.assurance.service.renewal.RenewalPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContratSearchServiceTest {

    @Mock
    private ContratRepository contratRepository;
    @Mock
    private ContratClientRepository contratClientRepository;
    @Mock
    private MouvementContratRepository mouvementContratRepository;
    @Mock
    private VehiculeRepository vehiculeRepository;
    @Mock
    private AvenantDraftService avenantDraftService;

    private ContratSearchService service;

    @BeforeEach
    void setUp() {
        service = new ContratSearchService(
                contratRepository,
                contratClientRepository,
                mouvementContratRepository,
                vehiculeRepository,
                avenantDraftService,
                new RenewalPolicy()
        );
    }

    @Test
    void groupsRenewalChainAndKeepsAllBatchLoadsTenantBound() {
        Contrat original = contract(1L, null, "D-1");
        Contrat renewal = contract(2L, original, "D-2");
        when(contratRepository.searchCurrentContractIds(
                eq(7L), eq(TypeContrat.CONVENTION), eq("EFFET"),
                eq(LocalDate.of(2026, 1, 1)), eq(LocalDate.of(2026, 12, 31)),
                eq("client"), eq(4L), eq("p-1"), eq(9L), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(2L)));
        when(contratRepository.findByAgenceIdAndIdIn(7L, List.of(2L))).thenReturn(List.of(renewal));
        when(contratRepository.findByAgenceIdAndIdIn(7L, List.of(1L))).thenReturn(List.of(original));
        stubAssociations(List.of(2L, 1L));

        var response = service.searchContracts(
                7L,
                TypeContrat.CONVENTION,
                "EFFET",
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 12, 31),
                " Client ",
                4L,
                " P-1 ",
                9L,
                0,
                25
        );

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().get(0).getContrats())
                .extracting(item -> item.getId())
                .containsExactly(2L, 1L);
        verify(avenantDraftService).listSummaries(eq(7L), any());
    }

    @Test
    void returnsPagedProspectionListWithoutLoadingContractDetail() {
        Contrat prospection = contract(3L, null, "DEV-3");
        prospection.setProspection(true);
        when(contratRepository.searchProspectionIds(
                eq(7L), eq(4L), eq(LocalDate.of(2026, 2, 1).atStartOfDay()),
                eq(LocalDate.of(2026, 3, 1).atStartOfDay()), eq("najiba"), eq("dev"),
                any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(3L)));
        when(contratRepository.findByAgenceIdAndIdIn(7L, List.of(3L))).thenReturn(List.of(prospection));
        stubAssociations(List.of(3L));

        PagedResponse<?> response = service.searchProspections(
                7L,
                4L,
                LocalDate.of(2026, 2, 1),
                LocalDate.of(2026, 2, 28),
                " Najiba ",
                " DEV ",
                0,
                25
        );

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getPage().getTotalElements()).isEqualTo(1);
    }

    private void stubAssociations(List<Long> ids) {
        when(contratClientRepository.findByContratIdIn(ids)).thenReturn(List.of());
        when(mouvementContratRepository.findByContratIdInOrderByCreatedAtDesc(ids)).thenReturn(List.of());
        when(vehiculeRepository.findByContratIdInOrderByCreatedAtAsc(ids)).thenReturn(List.of());
        when(avenantDraftService.listSummaries(7L, ids)).thenReturn(List.of());
    }

    private Contrat contract(Long id, Contrat origin, String dossier) {
        CompagnieAssurance company = CompagnieAssurance.builder().code("MATU").nom("MATU").build();
        company.setId(4L);
        Contrat contract = Contrat.builder()
                .typeContrat(TypeContrat.CONVENTION)
                .statut(StatutContrat.ACTIVE)
                .numeroDossier(dossier)
                .compagnieAssurance(company)
                .contratOrigine(origin)
                .prospection(false)
                .brouillon(false)
                .build();
        contract.setId(id);
        return contract;
    }
}
