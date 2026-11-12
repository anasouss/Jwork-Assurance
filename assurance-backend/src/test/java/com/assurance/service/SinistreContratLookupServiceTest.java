package com.assurance.service;

import com.assurance.entity.BrancheAssurance;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.Contrat;
import com.assurance.exception.BadRequestException;
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
        when(contracts.search(7L, 3L, "%abc!%!_!!%", PageRequest.of(0, 20))).thenReturn(List.of());

        assertThat(service.search(7L, 3L, " ABC%_! ")).isEmpty();

        verify(contracts).search(7L, 3L, "%abc!%!_!!%", PageRequest.of(0, 20));
        verifyNoInteractions(clients);
    }

    @Test
    void lookupKeepsSeparateContractPeriodsEvenWithTheSamePolicyNumber() {
        var old = contract(1L, 2025);
        var current = contract(2L, 2026);
        when(contracts.search(7L, 3L, "%000123%", PageRequest.of(0, 20))).thenReturn(List.of(current, old));
        when(clients.findByContratIdIn(List.of(2L, 1L))).thenReturn(List.of());

        var results = service.search(7L, 3L, "000123");

        assertThat(results).extracting(item -> item.id()).containsExactly(2L, 1L);
        assertThat(results).extracting(item -> item.dateEffet().getYear()).containsExactly(2026, 2025);
        assertThat(results).allMatch(item -> item.numeroPolice().equals("000123"));
    }

    @Test
    void incompleteLookupIsRejectedBeforeReadingOperationalData() {
        assertThatThrownBy(() -> service.search(7L, null, "POLICE")).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.search(7L, 3L, "A")).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(contracts, clients);
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
