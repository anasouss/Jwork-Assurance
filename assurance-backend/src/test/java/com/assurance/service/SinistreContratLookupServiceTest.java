package com.assurance.service;

import com.assurance.entity.BrancheAssurance;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.Contrat;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.MouvementVehicule;
import com.assurance.entity.Vehicule;
import com.assurance.exception.BadRequestException;
import com.assurance.enums.TypeRechercheContratSinistre;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.SinistreContratLookupRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class SinistreContratLookupServiceTest {

    private final SinistreContratLookupRepository contracts = mock(SinistreContratLookupRepository.class);
    private final ContratClientRepository clients = mock(ContratClientRepository.class);
    private final SinistreContratLookupService service = new SinistreContratLookupService(contracts, clients);

    @Test
    void lookupIsAgencyAndBranchScopedAndEscapesLikeWildcards() {
        when(contracts.search(7L, 3L, "ASSURE", "%abc!%!_!!%", PageRequest.of(0, 20))).thenReturn(List.of());

        assertThat(service.search(7L, 3L, " ABC%_! ", TypeRechercheContratSinistre.ASSURE)).isEmpty();

        verify(contracts).search(7L, 3L, "ASSURE", "%abc!%!_!!%", PageRequest.of(0, 20));
        verifyNoInteractions(clients);
    }

    @Test
    void lookupKeepsSeparateContractPeriodsEvenWithTheSamePolicyNumber() {
        var old = contract(1L, 2025);
        var current = contract(2L, 2026);
        when(contracts.search(7L, 3L, "POLICE", "000123", PageRequest.of(0, 20))).thenReturn(List.of(current, old));
        when(clients.findByContratIdIn(List.of(2L, 1L))).thenReturn(List.of());

        var results = service.search(7L, 3L, "000123", TypeRechercheContratSinistre.POLICE);

        assertThat(results).extracting(item -> item.id()).containsExactly(2L, 1L);
        assertThat(results).extracting(item -> item.dateEffet().getYear()).containsExactly(2026, 2025);
        assertThat(results).allMatch(item -> item.numeroPolice().equals("000123"));
    }

    @Test
    void incompleteLookupIsRejectedBeforeReadingOperationalData() {
        assertThatThrownBy(() -> service.search(7L, null, "POLICE", TypeRechercheContratSinistre.POLICE)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.search(7L, 3L, "AB", TypeRechercheContratSinistre.ASSURE)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.search(7L, 3L, " - ", TypeRechercheContratSinistre.IMMATRICULATION)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(contracts, clients);
    }

    @Test
    void registrationMatchesCarryVehicleIdsWithinTheirOwnPolicy() {
        var first = contract(1L, 2026);
        var second = contract(2L, 2026);
        var vehicle = new Vehicule();
        vehicle.setId(30L);
        var snapshot = MouvementVehicule.builder().vehicule(vehicle).immatriculation("7571-A-73")
                .mouvementContrat(MouvementContrat.builder().contrat(first).build()).build();
        when(contracts.search(7L, 3L, "IMMATRICULATION", "7571a73", PageRequest.of(0, 20))).thenReturn(List.of(first, second));
        when(contracts.matchingVehicles(7L, List.of(1L, 2L), "7571a73")).thenReturn(List.of(snapshot, snapshot));

        var results = service.search(7L, 3L, " 7571 - A - 73 ", TypeRechercheContratSinistre.IMMATRICULATION);

        assertThat(results.get(0).vehiculesCorrespondants()).singleElement().satisfies(match -> {
            assertThat(match.id()).isEqualTo(30L);
            assertThat(match.immatriculation()).isEqualTo("7571-A-73");
        });
        assertThat(results.get(1).vehiculesCorrespondants()).isEmpty();
        verify(contracts).matchingVehicles(7L, List.of(1L, 2L), "7571a73");
    }

    private Contrat contract(Long id, int year) {
        var contract = Contrat.builder().numeroPolice("000123")
                .dateEffet(LocalDate.of(year, 1, 1)).dateEcheance(LocalDate.of(year, 12, 31))
                .brancheAssurance(BrancheAssurance.builder().code("AUTOMOBILE").libelle("Automobile").build())
                .compagnieAssurance(CompagnieAssurance.builder().code("CIE").nom("Compagnie").build()).build();
        contract.setId(id);
        return contract;
    }
}
