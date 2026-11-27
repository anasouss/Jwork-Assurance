package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.Contrat;
import com.assurance.entity.DocumentPolicy;
import com.assurance.entity.NaturePieceJointe;
import com.assurance.entity.PieceJointe;
import com.assurance.entity.Sinistre;
import com.assurance.entity.SinistreDocument;
import com.assurance.entity.TypePieceJointe;
import com.assurance.entity.Utilisateur;
import com.assurance.entity.Vehicule;
import com.assurance.enums.DocumentOwner;
import com.assurance.enums.DocumentValiditySource;
import com.assurance.enums.StatutDocumentSinistre;
import com.assurance.enums.StatutSinistre;
import com.assurance.enums.TypeDocumentSinistre;
import com.assurance.repository.DocumentPolicyRepository;
import com.assurance.repository.PieceJointeRepository;
import com.assurance.repository.SinistreDocumentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class SinistreProductionDocumentServiceTest {
    private final PieceJointeRepository pieces = mock(PieceJointeRepository.class);
    private final DocumentPolicyRepository policies = mock(DocumentPolicyRepository.class);
    private final SinistreDocumentRepository documents = mock(SinistreDocumentRepository.class);
    private final SinistreEvenementService events = mock(SinistreEvenementService.class);
    private final StorageLayoutService storage = mock(StorageLayoutService.class);
    private final SinistreProductionDocumentService service = new SinistreProductionDocumentService(pieces, policies, documents, events, storage);
    private final Utilisateur actor = new Utilisateur();
    private Sinistre claim;
    private PieceJointe source;
    @TempDir
    Path directory;

    @BeforeEach
    void setUp() throws Exception {
        Agence agency = new Agence();
        agency.setId(1L);
        Contrat contract = Contrat.builder().agence(agency).build();
        contract.setId(10L);
        Vehicule vehicle = Vehicule.builder().contrat(contract).build();
        vehicle.setId(20L);
        claim = Sinistre.builder().agence(agency).contrat(contract).vehicule(vehicle)
                .statut(StatutSinistre.DECLARE).dateSinistre(LocalDate.of(2026, 11, 19)).build();
        claim.setId(30L);
        NaturePieceJointe nature = NaturePieceJointe.builder().defaultOwner(DocumentOwner.VEHICULE)
                .defaultValiditySource(DocumentValiditySource.VEHICULE_CARTE_GRISE).build();
        nature.setId(40L);
        source = PieceJointe.builder().agence(agency).contrat(contract).vehicule(vehicle)
                .documentOwner(DocumentOwner.VEHICULE).typePieceJointe(TypePieceJointe.builder().naturePieceJointe(nature).build())
                .nomFichier("CG.pdf").contentType("application/pdf").tailleOctets(100L)
                .cheminStockage("1/10/cg.pdf").build();
        source.setId(50L);
        when(pieces.findClaimVehicleCandidates(1L, 20L)).thenReturn(List.of(source));
        when(pieces.lockClaimSource(1L, 50L)).thenReturn(Optional.of(source));
        when(policies.findByAgenceIdAndNatureId(1L, 40L)).thenReturn(Optional.empty());
        when(storage.resolveClaimDocument(any(SinistreDocument.class))).thenReturn(Files.createFile(directory.resolve("cg.pdf")));
    }

    @Test
    void linksOneSourceWithoutCopyingOrAutomaticallyValidatingIt() {
        service.attachAvailable(claim, actor);
        var capture = ArgumentCaptor.forClass(SinistreDocument.class);
        verify(documents).save(capture.capture());
        SinistreDocument linked = capture.getValue();
        assertThat(linked.getSourcePieceJointe()).isSameAs(source);
        assertThat(linked.getCheminStockage()).isEqualTo(source.getCheminStockage());
        assertThat(linked.getType()).isEqualTo(TypeDocumentSinistre.CARTE_GRISE);
        assertThat(linked.getStatut()).isEqualTo(StatutDocumentSinistre.RECU);
        assertThat(linked.getValidePar()).isNull();
        assertThat(linked.getDateValidation()).isNull();
    }

    @Test
    void existingUploadOrRejectedLinkIsNeverReplaced() {
        when(documents.existsBySinistreIdAndType(30L, TypeDocumentSinistre.CARTE_GRISE)).thenReturn(true);
        service.attachAvailable(claim, actor);
        verifyNoInteractions(pieces);
        verify(documents, never()).save(any());
    }

    @Test
    void ambiguousSourcesAreSkipped() {
        when(pieces.findClaimVehicleCandidates(1L, 20L)).thenReturn(List.of(source, source));
        service.attachAvailable(claim, actor);
        verify(documents, never()).save(any());
    }

    @Test
    void expiryIsEvaluatedAtTheLossDateNotToday() {
        source.setExpiresOn(claim.getDateSinistre());
        service.attachAvailable(claim, actor);
        verify(documents).save(any());
    }

    @Test
    void documentExpiredBeforeTheLossIsSkipped() {
        source.setExpiresOn(claim.getDateSinistre().minusDays(1));
        service.attachAvailable(claim, actor);
        verify(documents, never()).save(any());
    }

    @Test
    void anotherAgencyCannotBecomeAClaimDocument() {
        Agence other = new Agence();
        other.setId(2L);
        source.setAgence(other);
        service.attachAvailable(claim, actor);
        verify(documents, never()).save(any());
    }

    @Test
    void anotherVehicleCannotBecomeAClaimDocument() {
        Vehicule other = new Vehicule();
        other.setId(99L);
        source.setVehicule(other);
        service.attachAvailable(claim, actor);
        verify(documents, never()).save(any());
    }

    @Test
    void legacyDocumentAgencyIsResolvedFromItsOwningContract() {
        source.setAgence(null);
        service.attachAvailable(claim, actor);
        verify(documents).save(any());
    }

    @Test
    void agencyPolicyOverridesNatureDefaults() {
        DocumentPolicy policy = new DocumentPolicy();
        policy.setOwner(DocumentOwner.CLIENT);
        policy.setValiditySource(DocumentValiditySource.CLIENT_PERMIS);
        when(policies.findByAgenceIdAndNatureId(1L, 40L)).thenReturn(Optional.of(policy));
        service.attachAvailable(claim, actor);
        verify(documents, never()).save(any());
    }

    @Test
    void missingFilesAreNotLinked() {
        when(storage.resolveClaimDocument(any(SinistreDocument.class))).thenReturn(directory.resolve("missing.pdf"));
        service.attachAvailable(claim, actor);
        verify(documents, never()).save(any());
    }

    @Test
    void closedClaimHistoryIsNotBackfilled() {
        claim.setStatut(StatutSinistre.CLOTURE);
        service.attachAvailable(claim, actor);
        verifyNoInteractions(pieces);
        verify(documents, never()).save(any());
    }
}
