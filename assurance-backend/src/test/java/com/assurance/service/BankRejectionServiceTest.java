package com.assurance.service;

import com.assurance.dto.request.ChangerStatutInstrumentReglementRequest;
import com.assurance.dto.response.ReglementClientResponse;
import com.assurance.dto.response.InstrumentReglementPageResponse;
import com.assurance.dto.response.SourceDocumentClientPageResponse;
import com.assurance.enums.StatutSuiviRejetBancaire;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.BordereauRemise;
import com.assurance.entity.LigneBordereauRemise;
import com.assurance.entity.ReglementClient;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.ResolutionRejetBancaire;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutBordereauRemise;
import com.assurance.enums.StatutLigneBordereauRemise;
import com.assurance.enums.StatutReglementClient;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.InstrumentReglementClientRepository;
import com.assurance.repository.EcartReglementClientRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.mock;

@ExtendWith(MockitoExtension.class)
class BankRejectionServiceTest {
    @Test
    void exportsAllFilteredPagesWithNumericAmountsAndSafeReferences() throws Exception {
        ReglementClientService searchService = mock(ReglementClientService.class);
        LocalDate from = LocalDate.of(2026, 11, 1);
        LocalDate to = LocalDate.of(2026, 11, 3);
        var item = ReglementClientResponse.Instrument.builder()
                .mode(ModeReglementClient.CHEQUE).referenceInstrument("=SUM(1)")
                .payeurNom("YASLID CARS").montant(new BigDecimal("5000.25"))
                .dateReglement(from).dateRejet(to).motifRejet("Signature non conforme")
                .statutSuiviRejet(StatutSuiviRejetBancaire.INSTANCE).build();
        for (int page = 0; page < 2; page++) {
            when(searchService.searchBankRejections(7L, ModeReglementClient.CHEQUE, null, from, to,
                    "CLIENT", 33L, null, "516", "AMOUNT", "ASC", page, 100))
                    .thenReturn(InstrumentReglementPageResponse.builder()
                            .page(SourceDocumentClientPageResponse.PageInfo.builder()
                                    .number(page).totalPages(2).build()).rows(List.of(item)).build());
        }
        byte[] bytes = new RejetBancaireExportService(searchService).export(7L, ModeReglementClient.CHEQUE,
                null, from, to, "CLIENT", 33L, null, "516", "AMOUNT", "ASC");
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            var sheet = workbook.getSheetAt(0);
            assertThat(sheet.getLastRowNum()).isEqualTo(2);
            assertThat(sheet.getRow(1).getCell(1).getCellType()).isEqualTo(CellType.STRING);
            assertThat(sheet.getRow(1).getCell(1).getStringCellValue()).isEqualTo("=SUM(1)");
            assertThat(sheet.getRow(1).getCell(3).getNumericCellValue()).isEqualTo(5000.25);
            assertThat(sheet.getRow(1).getCell(5).getLocalDateTimeCellValue().toLocalDate()).isEqualTo(to);
            assertThat(sheet.getRow(1).getCell(7).getStringCellValue()).isEqualTo("En instance");
            assertThat(sheet.getPaneInformation().isFreezePane()).isTrue();
        }
        verify(searchService).searchBankRejections(7L, ModeReglementClient.CHEQUE, null, from, to,
                "CLIENT", 33L, null, "516", "AMOUNT", "ASC", 1, 100);
    }

    @Mock
    private InstrumentReglementClientRepository instrumentRepository;
    @Mock
    private EcartReglementClientRepository ecartRepository;
    @Mock
    private RejetBancaireSuiviService rejetSuiviService;

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
    void pendingChequeCanBeReplacedWithoutBeingMarkedAsOfficePayment() {
        InstrumentReglementClient instrument = instrument();
        instrument.setStatut(StatutInstrumentReglement.EN_ATTENTE);
        instrument.setReglementBureau(false);
        assertThat(service.toInstrumentRegisterResponse(instrument).getRemplacementPossible()).isTrue();
        instrument.getReglement().setMultiPayeur(true);
        assertThat(service.toInstrumentRegisterResponse(instrument).getRemplacementPossible()).isFalse();
    }

    @Test
    void draftReservedChequeCannotBeOfferedForReplacement() {
        InstrumentReglementClient instrument = instrument();
        instrument.setStatut(StatutInstrumentReglement.EN_ATTENTE);
        LigneBordereauRemise line = LigneBordereauRemise.builder()
                .bordereau(BordereauRemise.builder().statut(StatutBordereauRemise.BROUILLON).build())
                .instrument(instrument).statut(StatutLigneBordereauRemise.PREPAREE).build();
        ReglementClientResponse.Instrument response = ReflectionTestUtils.invokeMethod(
                service, "toInstrumentRegisterResponse", instrument, line);
        assertThat(response.getRemplacementPossible()).isFalse();
    }

    @Test
    void remittedChequeCannotBeOfferedForReplacement() {
        assertThat(service.toInstrumentRegisterResponse(instrument()).getRemplacementPossible()).isFalse();
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
