package com.assurance.service;

import com.assurance.activity.BusinessActivityRecorder;
import com.assurance.dto.request.CreateSinistreRequest;
import com.assurance.dto.request.InitialSinistreDocumentRequest;
import com.assurance.dto.request.UpsertMissionExpertiseRequest;
import com.assurance.dto.response.SinistreDetailResponse;
import com.assurance.entity.Sinistre;
import com.assurance.enums.PhaseExpertiseSinistre;
import com.assurance.enums.TypeDocumentSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.GarageSinistreRepository;
import com.assurance.repository.MissionExpertiseRepository;
import com.assurance.repository.SinistreDocumentRepository;
import com.assurance.repository.SinistreGarantieRepository;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class SinistreOuvertureServiceTest {
    private final SinistreService claims = mock(SinistreService.class);
    private final SinistreDossierService dossiers = mock(SinistreDossierService.class);
    private final SinistreDocumentService documents = mock(SinistreDocumentService.class);
    private final ValidatorFactory validators = Validation.buildDefaultValidatorFactory();
    private final SinistreOuvertureService service = new SinistreOuvertureService(
            claims, dossiers, documents, validators.getValidator());

    @AfterEach
    void closeValidatorFactory() {
        validators.close();
    }

    @Test
    void missingMetadataFailsBeforeAnyClaimIsCreated() {
        assertThatThrownBy(() -> service.ouvrir(1L, 7L, new CreateSinistreRequest(), List.of(), List.of(pdf())))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("metadonnees");
        verifyNoInteractions(claims, dossiers, documents);
    }

    @Test
    void financeDocumentAndInvalidMetadataAreRejectedBeforeCreation() {
        InitialSinistreDocumentRequest document = document(TypeDocumentSinistre.FACTURE);
        assertThatThrownBy(() -> service.ouvrir(1L, 7L, new CreateSinistreRequest(), List.of(document), List.of(pdf())))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("uniquement");
        document.setType(TypeDocumentSinistre.CONSTAT);
        document.setCommentaire("x".repeat(501));
        assertThatThrownBy(() -> service.ouvrir(1L, 7L, new CreateSinistreRequest(), List.of(document), List.of(pdf())))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("commentaire");
        verifyNoInteractions(claims, dossiers, documents);
    }

    @Test
    void initialExpertMustBeBeforeRepairs() {
        CreateSinistreRequest request = new CreateSinistreRequest();
        UpsertMissionExpertiseRequest expert = new UpsertMissionExpertiseRequest();
        expert.setPhase(PhaseExpertiseSinistre.APRES);
        request.setExpertInitial(expert);
        assertThatThrownBy(() -> service.ouvrir(1L, 7L, request, List.of(), List.of()))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("AVANT");
        verifyNoInteractions(claims, dossiers, documents);
    }

    @Test
    void creationExpertAndFilesAreOrchestratedInOrder() {
        CreateSinistreRequest request = new CreateSinistreRequest();
        UpsertMissionExpertiseRequest expert = new UpsertMissionExpertiseRequest();
        request.setExpertInitial(expert);
        SinistreDetailResponse detail = SinistreDetailResponse.builder().id(10L).build();
        when(claims.create(1L, 7L, request)).thenReturn(detail);
        when(claims.get(1L, 10L)).thenReturn(detail);
        MultipartFile file = pdf();
        assertThat(service.ouvrir(1L, 7L, request, List.of(document(TypeDocumentSinistre.CONSTAT)), List.of(file)))
                .isSameAs(detail);
        var ordered = inOrder(claims, dossiers, documents);
        ordered.verify(claims).create(1L, 7L, request);
        ordered.verify(dossiers).saveMission(1L, 7L, 10L, null, expert);
        ordered.verify(documents).upload(1L, 7L, 10L, TypeDocumentSinistre.CONSTAT,
                null, null, null, null, null, null, null, null, file);
        ordered.verify(claims).get(1L, 10L);
    }

    @Test
    void aLaterInvalidFileRollsBackPreviouslyStoredOpeningFile(@TempDir Path directory) throws Exception {
        SinistreWorkflowService workflow = mock(SinistreWorkflowService.class);
        SinistreResponseMapper mapper = mock(SinistreResponseMapper.class);
        StorageLayoutService storage = mock(StorageLayoutService.class);
        BusinessActivityRecorder activity = mock(BusinessActivityRecorder.class);
        Sinistre claim = Sinistre.builder().build();
        claim.setId(10L);
        SinistreDetailResponse detail = SinistreDetailResponse.builder().id(10L).build();
        when(claims.create(eq(1L), eq(7L), any())).thenReturn(detail);
        when(claims.resolveForUpdate(1L, 10L)).thenReturn(claim);
        when(workflow.isEditable(claim)).thenReturn(true);
        when(mapper.toDetail(claim)).thenReturn(detail);
        when(storage.resolveClaimDocument(anyString())).thenAnswer(call -> directory.resolve(call.getArgument(0, String.class)));
        doAnswer(call -> call.getArgument(0, Supplier.class).get()).when(activity).perform(any(), any());
        SinistreDocumentService realDocuments = new SinistreDocumentService(
                mock(SinistreDocumentRepository.class), mock(SinistreGarantieRepository.class),
                mock(MissionExpertiseRepository.class), mock(GarageSinistreRepository.class), claims, workflow,
                mock(SinistreEvenementService.class), mapper, storage, activity);
        SinistreOuvertureService target = new SinistreOuvertureService(claims, dossiers, realDocuments, validators.getValidator());
        TestTransactionManager transactions = new TestTransactionManager();
        ProxyFactory proxy = new ProxyFactory(target);
        proxy.setProxyTargetClass(true);
        proxy.addAdvice(new TransactionInterceptor(transactions, new AnnotationTransactionAttributeSource()));
        SinistreOuvertureService transactional = (SinistreOuvertureService) proxy.getProxy();
        MultipartFile invalid = new MockMultipartFile("files", "unsafe.exe", "application/octet-stream", new byte[]{1});

        assertThatThrownBy(() -> transactional.ouvrir(1L, 7L, new CreateSinistreRequest(),
                List.of(document(TypeDocumentSinistre.CONSTAT), document(TypeDocumentSinistre.DECLARATION)),
                List.of(pdf(), invalid))).isInstanceOf(BadRequestException.class);

        assertThat(transactions.rolledBack).isTrue();
        try (var paths = Files.walk(directory)) {
            assertThat(paths.filter(Files::isRegularFile).toList()).isEmpty();
        }
    }

    private InitialSinistreDocumentRequest document(TypeDocumentSinistre type) {
        InitialSinistreDocumentRequest result = new InitialSinistreDocumentRequest();
        result.setType(type);
        return result;
    }

    private MultipartFile pdf() {
        return new MockMultipartFile("files", "constat.pdf", "application/pdf", "%PDF-1.7".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
    }

    private static class TestTransactionManager extends AbstractPlatformTransactionManager {
        private boolean rolledBack;

        @Override
        protected Object doGetTransaction() {
            return new Object();
        }

        @Override
        protected void doBegin(Object transaction, TransactionDefinition definition) {
        }

        @Override
        protected void doCommit(DefaultTransactionStatus status) {
        }

        @Override
        protected void doRollback(DefaultTransactionStatus status) {
            rolledBack = true;
        }
    }
}
