package com.assurance.service;

import com.assurance.dto.request.ChangerStatutInstrumentReglementRequest;
import com.assurance.dto.response.ReglementClientResponse;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.ReglementClient;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.ResolutionRejetBancaire;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutReglementClient;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.InstrumentReglementClientRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BankRejectionServiceTest {
    @Mock
    private InstrumentReglementClientRepository instrumentRepository;

    @Spy
    @InjectMocks
    private ReglementClientService service;

    @Test
    void recordsRejectionSnapshotAndKeepsItAfterReplacement() {
        InstrumentReglementClient instrument = instrument();
        LocalDate rejectionDate = LocalDate.now().minusDays(1);
        ReflectionTestUtils.invokeMethod(service, "rejectInstrument", instrument, "  Sans provision  ", rejectionDate);
        assertThat(instrument.getDateRejet()).isEqualTo(rejectionDate);
        assertThat(instrument.getMotifRejet()).isEqualTo("Sans provision");
        instrument.setStatut(StatutInstrumentReglement.REMPLACE);
        instrument.setDateStatut(LocalDate.now());
        instrument.setMotifStatut("Remplacement par des especes");

        var response = service.toInstrumentRegisterResponse(instrument);
        assertThat(response.getDateRejet()).isEqualTo(rejectionDate);
        assertThat(response.getMotifRejet()).isEqualTo("Sans provision");
        assertThat(response.getResolutionRejet()).isEqualTo(ResolutionRejetBancaire.REMPLACE);
        assertThat(response.getRemplacementPossible()).isFalse();
        assertThat(response.getRepresentationPossible()).isFalse();
    }

    @Test
    void representedInstrumentRetainsItsOriginalRejectionDate() {
        InstrumentReglementClient instrument = instrument();
        instrument.setDateRejet(LocalDate.now().minusDays(2));
        instrument.setMotifRejet("Sans provision");
        instrument.setStatut(StatutInstrumentReglement.EN_ATTENTE);
        instrument.setDateStatut(LocalDate.now());
        var response = service.toInstrumentRegisterResponse(instrument);
        assertThat(response.getDateRejet()).isEqualTo(LocalDate.now().minusDays(2));
        assertThat(response.getResolutionRejet()).isEqualTo(ResolutionRejetBancaire.REPRESENTE);
    }

    @Test
    void multiPayerRejectionCanBeRepresentedButNotReplaced() {
        InstrumentReglementClient instrument = instrument();
        instrument.setStatut(StatutInstrumentReglement.REJETE);
        instrument.getReglement().setMultiPayeur(true);
        var response = service.toInstrumentRegisterResponse(instrument);
        assertThat(response.getRepresentationPossible()).isTrue();
        assertThat(response.getRemplacementPossible()).isFalse();
    }

    @Test
    void newRejectionDelegatesToTheEstablishedAccountingTransition() {
        InstrumentReglementClient instrument = instrument();
        when(instrumentRepository.findByIdAndAgenceIdForUpdate(9L, 7L)).thenReturn(Optional.of(instrument));
        var expected = ReglementClientResponse.builder().build();
        doReturn(expected).when(service).changeInstrumentStatus(anyLong(), anyLong(), any());
        var request = request(LocalDate.now());
        assertThat(service.registerBankRejection(7L, 9L, request)).isSameAs(expected);
        assertThat(request.getStatut()).isEqualTo(StatutInstrumentReglement.REJETE);
        verify(service).changeInstrumentStatus(7L, 9L, request);
    }

    @Test
    void refusesFutureRejectionAndRejectionBeforeRemittance() {
        InstrumentReglementClient instrument = instrument();
        when(instrumentRepository.findByIdAndAgenceIdForUpdate(9L, 7L)).thenReturn(Optional.of(instrument));
        assertThatThrownBy(() -> service.registerBankRejection(7L, 9L, request(LocalDate.now().plusDays(1))))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.registerBankRejection(7L, 9L, request(LocalDate.now().minusDays(4))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void refusesPendingChequesAndNonChequeModes() {
        InstrumentReglementClient instrument = instrument();
        when(instrumentRepository.findByIdAndAgenceIdForUpdate(9L, 7L)).thenReturn(Optional.of(instrument));
        instrument.setStatut(StatutInstrumentReglement.EN_ATTENTE);
        assertThatThrownBy(() -> service.registerBankRejection(7L, 9L, request(LocalDate.now())))
                .isInstanceOf(BadRequestException.class);
        instrument.setStatut(StatutInstrumentReglement.CONFIRME);
        instrument.setMode(ModeReglementClient.ESPECES);
        assertThatThrownBy(() -> service.registerBankRejection(7L, 9L, request(LocalDate.now())))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void neverLooksUpAnInstrumentOutsideTheCurrentAgency() {
        when(instrumentRepository.findByIdAndAgenceIdForUpdate(9L, 7L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.registerBankRejection(7L, 9L, request(LocalDate.now())))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(instrumentRepository).findByIdAndAgenceIdForUpdate(9L, 7L);
    }

    private InstrumentReglementClient instrument() {
        return InstrumentReglementClient.builder()
                .reglement(ReglementClient.builder().statut(StatutReglementClient.VALIDE).build())
                .mode(ModeReglementClient.CHEQUE)
                .statut(StatutInstrumentReglement.REMIS_EN_BANQUE)
                .dateStatut(LocalDate.now().minusDays(3))
                .build();
    }

    private ChangerStatutInstrumentReglementRequest request(LocalDate date) {
        var request = new ChangerStatutInstrumentReglementRequest();
        request.setStatut(StatutInstrumentReglement.REJETE);
        request.setDateOperation(date);
        request.setMotif("Sans provision");
        return request;
    }
}
