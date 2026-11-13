package com.assurance.service;

import com.assurance.activity.ActivityAction;
import com.assurance.activity.ActivityCommand;
import com.assurance.activity.BusinessActivityRecorder;
import com.assurance.dto.request.AnnulerDocumentClientRequest;
import com.assurance.entity.Agence;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.EcheanceFacturationConvention;
import com.assurance.enums.StatutDocumentClient;
import com.assurance.enums.StatutEcheanceFacturationConvention;
import com.assurance.enums.TypeDocumentClient;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.DocumentClientRepository;
import com.assurance.repository.EcheanceFacturationConventionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentClientDeletionTest {
    @Mock private DocumentClientRepository documents;
    @Mock private EcheanceFacturationConventionRepository schedules;
    @Mock private BusinessActivityRecorder activity;
    @InjectMocks private DocumentClientService service;

    @Test
    void deletesUnpaidInvoiceReleasesSchedulesAndKeepsAuditSnapshot() {
        DocumentClient document = invoice();
        EcheanceFacturationConvention schedule = EcheanceFacturationConvention.builder()
                .documentClient(document).statut(StatutEcheanceFacturationConvention.FACTUREE).build();
        when(documents.findByAgenceIdAndIdForUpdate(7L, 12L)).thenReturn(Optional.of(document));
        when(schedules.findByAgenceIdAndDocumentClientId(7L, 12L)).thenReturn(List.of(schedule));

        service.delete(7L, 12L, reason());

        assertThat(schedule.getDocumentClient()).isNull();
        assertThat(schedule.getStatut()).isEqualTo(StatutEcheanceFacturationConvention.A_FACTURER);
        var command = ArgumentCaptor.forClass(ActivityCommand.class);
        verify(activity).record(command.capture());
        assertThat(command.getValue().action()).isEqualTo(ActivityAction.DELETED);
        assertThat(command.getValue().changes()).anySatisfy(change -> {
            assertThat(change.label()).isEqualTo("Numéro");
            assertThat(change.beforeValue()).isEqualTo("FAC-26-000012");
            assertThat(change.afterValue()).isNull();
        }).anySatisfy(change -> {
            assertThat(change.label()).isEqualTo("Motif de suppression");
            assertThat(change.afterValue()).isEqualTo("Erreur de saisie");
        });
        verify(schedules).saveAll(List.of(schedule));
        verify(documents).delete(document);
        verify(documents).flush();
    }

    @Test
    void refusesAnyPaymentHistoryIncludingCancelledAllocations() {
        when(documents.findByAgenceIdAndIdForUpdate(7L, 12L)).thenReturn(Optional.of(invoice()));
        when(documents.hasPaymentHistory(7L, 12L)).thenReturn(true);
        assertThatThrownBy(() -> service.delete(7L, 12L, reason())).isInstanceOf(BadRequestException.class);
        verify(documents, never()).delete(any(DocumentClient.class));
        verifyNoInteractions(schedules, activity);
    }

    @Test
    void refusesBothSidesOfReplacementChain() {
        DocumentClient document = invoice();
        when(documents.findByAgenceIdAndIdForUpdate(7L, 12L)).thenReturn(Optional.of(document));
        document.setDocumentOrigine(new DocumentClient());
        assertThatThrownBy(() -> service.delete(7L, 12L, reason())).isInstanceOf(BadRequestException.class);
        document.setDocumentOrigine(null);
        document.setDocumentRemplacement(new DocumentClient());
        assertThatThrownBy(() -> service.delete(7L, 12L, reason())).isInstanceOf(BadRequestException.class);
        verify(documents, never()).delete(any(DocumentClient.class));
        verifyNoInteractions(schedules, activity);
    }

    @Test
    void refusesCancelledDocumentsAndStatements() {
        DocumentClient document = invoice();
        when(documents.findByAgenceIdAndIdForUpdate(7L, 12L)).thenReturn(Optional.of(document));
        document.setStatut(StatutDocumentClient.ANNULE);
        assertThatThrownBy(() -> service.delete(7L, 12L, reason())).isInstanceOf(BadRequestException.class);
        document.setStatut(StatutDocumentClient.EMIS);
        document.setTypeDocument(TypeDocumentClient.RELEVE);
        assertThatThrownBy(() -> service.delete(7L, 12L, reason())).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(schedules, activity);
    }

    @Test
    void scopesDeletionToCurrentAgency() {
        when(documents.findByAgenceIdAndIdForUpdate(8L, 12L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.delete(8L, 12L, reason())).isInstanceOf(ResourceNotFoundException.class);
        verify(documents, never()).delete(any(DocumentClient.class));
        verifyNoInteractions(schedules, activity);
    }

    private DocumentClient invoice() {
        Agence agency = Agence.builder().build();
        agency.setId(7L);
        DocumentClient document = DocumentClient.builder().agence(agency).numero("FAC-26-000012")
                .typeDocument(TypeDocumentClient.FACTURE).payeurNom("Client").build();
        document.setId(12L);
        return document;
    }

    private AnnulerDocumentClientRequest reason() {
        AnnulerDocumentClientRequest request = new AnnulerDocumentClientRequest();
        request.setMotif(" Erreur de saisie ");
        return request;
    }
}
