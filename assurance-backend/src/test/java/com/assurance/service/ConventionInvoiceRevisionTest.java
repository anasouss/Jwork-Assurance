package com.assurance.service;

import com.assurance.dto.request.RectifierFactureConventionRequest;
import com.assurance.entity.Agence;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.EcheanceFacturationConvention;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.enums.StatutDocumentClient;
import com.assurance.enums.TypeDocumentClient;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.DocumentClientRepository;
import com.assurance.repository.EcheanceFacturationConventionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConventionInvoiceRevisionTest {
    @Mock private AgenceRepository agencies;
    @Mock private DocumentClientRepository documents;
    @Mock private EcheanceFacturationConventionRepository schedules;
    @InjectMocks private DocumentClientService service;

    @BeforeEach
    void authorize() {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(
                "actor", "unused", "PERM_facture-convention:revise"));
        when(agencies.findByIdForUpdate(7L)).thenReturn(Optional.of(agency()));
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void cannotReadAnotherAgencysInvoice() {
        when(documents.findByAgenceIdAndIdForUpdate(7L, 12L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.reviseConvention(7L, 12L, request(8L)))
                .isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(schedules);
    }

    @Test
    void anyPaymentHistoryBlocksRevision() {
        when(documents.findByAgenceIdAndIdForUpdate(7L, 12L)).thenReturn(Optional.of(invoice()));
        when(documents.hasPaymentHistory(7L, 12L)).thenReturn(true);
        assertThatThrownBy(() -> service.reviseConvention(7L, 12L, request(8L)))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("historique");
        verifyNoInteractions(schedules);
        verify(documents, never()).save(any());
    }

    @Test
    void cannotIncludeAnUnrelatedBillingPeriod() {
        when(documents.findByAgenceIdAndIdForUpdate(7L, 12L)).thenReturn(Optional.of(invoice()));
        assertThatThrownBy(() -> service.reviseConvention(7L, 12L, request(999L)))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("origine");
        verifyNoInteractions(schedules);
    }

    @Test
    void supersededInvoiceCannotBeRevised() {
        DocumentClient invoice = invoice();
        invoice.setStatut(StatutDocumentClient.REMPLACE);
        when(documents.findByAgenceIdAndIdForUpdate(7L, 12L)).thenReturn(Optional.of(invoice));
        assertThatThrownBy(() -> service.reviseConvention(7L, 12L, request(8L)))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("dernière version");
        verifyNoInteractions(schedules);
    }

    private Agence agency() {
        Agence agency = Agence.builder().build();
        agency.setId(7L);
        return agency;
    }

    private DocumentClient invoice() {
        EcheanceFacturationConvention schedule = EcheanceFacturationConvention.builder().build();
        schedule.setId(8L);
        DocumentClient invoice = DocumentClient.builder().agence(agency()).typeDocument(TypeDocumentClient.FACTURE).build();
        invoice.setId(12L);
        invoice.getLignes().add(LigneDocumentClient.builder().echeanceFacturationConvention(schedule).build());
        return invoice;
    }

    private RectifierFactureConventionRequest request(Long scheduleId) {
        RectifierFactureConventionRequest request = new RectifierFactureConventionRequest();
        request.setEcheanceIds(List.of(scheduleId));
        request.setMotif("Correction de la période");
        return request;
    }
}
