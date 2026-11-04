package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.BrancheAssurance;
import com.assurance.entity.Contrat;
import com.assurance.entity.PieceJointe;
import com.assurance.dto.response.PieceJointeResponse;
import com.assurance.entity.ProduitAssistance;
import com.assurance.entity.TypePieceJointe;
import com.assurance.enums.TypeAssistance;
import com.assurance.enums.TypeContrat;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.BrancheAssuranceRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.NaturePieceJointeRepository;
import com.assurance.repository.PieceJointeRepository;
import com.assurance.repository.TypeMouvementContratRepository;
import com.assurance.repository.TypePieceJointeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

@ExtendWith(MockitoExtension.class)
class PieceJointeServiceTest {

    @Mock private ContratRepository contratRepository;
    @Mock private AgenceRepository agenceRepository;
    @Mock private MouvementContratRepository mouvementContratRepository;
    @Mock private NaturePieceJointeRepository naturePieceJointeRepository;
    @Mock private TypeMouvementContratRepository typeMouvementContratRepository;
    @Mock private TypePieceJointeRepository typePieceJointeRepository;
    @Mock private PieceJointeRepository pieceJointeRepository;
    @Mock private AssistanceContratRepository assistanceContratRepository;
    @Mock private BrancheAssuranceRepository brancheAssuranceRepository;
    @Mock private StorageLayoutService storageLayoutService;
    @Mock private com.assurance.repository.DocumentPolicyRepository documentPolicyRepository;
    @Mock private com.assurance.repository.DocumentUsageRepository documentUsageRepository;
    @Mock private com.assurance.repository.ClientRepository clientRepository;
    @Mock private com.assurance.repository.VehiculeRepository vehiculeRepository;

    private PieceJointeService service;

    @BeforeEach
    void setUp() {
        service = new PieceJointeService(
                contratRepository,
                agenceRepository,
                mouvementContratRepository,
                naturePieceJointeRepository,
                typeMouvementContratRepository,
                typePieceJointeRepository,
                pieceJointeRepository,
                assistanceContratRepository,
                brancheAssuranceRepository,
                storageLayoutService, documentPolicyRepository, documentUsageRepository, clientRepository, vehiculeRepository
        );
    }

    @Test
    void legacyStorageNamesAreReadableInResponsesWithoutChangingStoredReferences() {
        Contrat contrat = Contrat.builder().build();
        contrat.setId(11L);
        TypePieceJointe type = type(1L, null, null, "CIN");
        for (String name : List.of(
                "cin-2026-11-03T16-02-37.956785552-218dd332-ec63-4c2f-a3c4-6bb8796786c7.pdf",
                "cin-2026-11-03T16-02-37-218dd332-ec63-4c2f-a3c4-6bb8796786c7.pdf",
                "cin-2026-11-03T16-02-218dd332-ec63-4c2f-a3c4-6bb8796786c7.pdf")) {
            String key = "7/11/contrat/" + name;
            PieceJointe piece = PieceJointe.builder().contrat(contrat).typePieceJointe(type)
                    .nomFichier(name).cheminStockage(key).contentType("application/pdf").build();

            PieceJointeResponse response = ReflectionTestUtils.invokeMethod(service, "toPieceResponse", piece);

            assertThat(response.getNomFichier()).isEqualTo("CIN.pdf");
            assertThat(piece.getNomFichier()).isEqualTo(name);
            assertThat(piece.getCheminStockage()).isEqualTo(key);
        }
    }

    @Test
    void preservesReadableOriginalNamesAndProvidesFallbackForMissingTypes() {
        PieceJointe original = PieceJointe.builder().nomFichier("Carte grise client.pdf").build();
        String readable = ReflectionTestUtils.invokeMethod(service, "displayFileName", original);
        assertThat(readable).isEqualTo("Carte grise client.pdf");

        PieceJointe missingType = PieceJointe.builder().contentType("application/pdf")
                .nomFichier("cin-2026-11-03T16-02-37-218dd332-ec63-4c2f-a3c4-6bb8796786c7.pdf").build();
        String fallback = ReflectionTestUtils.invokeMethod(service, "displayFileName", missingType);
        assertThat(fallback).isEqualTo("Document.pdf");
    }

    @Test
    void cleansClientPathsAndUnsafeFilenameCharacters() {
        String windows = ReflectionTestUtils.invokeMethod(service, "safeFileName", "C:\\fakepath\\CIN client.pdf");
        String unix = ReflectionTestUtils.invokeMethod(service, "safeFileName", "../../carte-grise.pdf");
        String unsafe = ReflectionTestUtils.invokeMethod(service, "safeFileName", "scan\r\n\"client.pdf");
        String longName = ReflectionTestUtils.invokeMethod(service, "safeFileName", "a".repeat(300) + ".pdf");
        assertThat(windows).isEqualTo("CIN client.pdf");
        assertThat(unix).isEqualTo("carte-grise.pdf");
        assertThat(unsafe).doesNotContain("\r", "\n", "\"");
        assertThat(longName).hasSize(255).endsWith(".pdf");
    }

    @Test
    void singleUploadKeepsAnOriginalDisplayNameWithAUniqueStoragePath(@TempDir Path folder) throws Exception {
        Contrat contrat = Contrat.builder().build();
        contrat.setId(11L);
        when(storageLayoutService.resolveContractAttachment(any(Path.class)))
                .thenAnswer(invocation -> folder.resolve(invocation.getArgument(0, Path.class)));
        var file = new MockMultipartFile("files", "C:\\fakepath\\CIN client.pdf", "application/pdf",
                "contents".getBytes(StandardCharsets.UTF_8));

        Object stored = ReflectionTestUtils.invokeMethod(service, "storeFiles", 7L, contrat, null,
                type(1L, null, null, "CIN"), List.of(file));
        String displayName = ReflectionTestUtils.invokeMethod(stored, "displayName");
        String storageKey = ReflectionTestUtils.invokeMethod(stored, "storageKey");
        Path path = ReflectionTestUtils.invokeMethod(stored, "path");

        assertThat(displayName).isEqualTo("CIN client.pdf");
        assertThat(Path.of(storageKey).getParent()).isEqualTo(Path.of("7", "11", "contrat"));
        assertThat(path.getFileName().toString()).startsWith("cin-").endsWith(".pdf").isNotEqualTo(displayName);
        assertThat(Files.readString(path)).isEqualTo("contents");
    }

    @Test
    void mergedImageDocumentsUseTheirTypeAsThePdfName() {
        String name = ReflectionTestUtils.invokeMethod(service, "readableFileName",
                type(1L, null, null, "Carte grise"), "pdf");
        assertThat(name).isEqualTo("Carte grise.pdf");
    }

    @Test
    void agencyOverrideReplacesSystemTypeAndCanDisableIt() {
        TypePieceJointe systemType = type(1L, null, null, "CIN");
        Agence agence = Agence.builder().build();
        agence.setId(7L);
        TypePieceJointe override = type(2L, null, null, "CIN");
        override.setAgence(agence);
        override.setSourceSysteme(systemType);
        override.setActif(false);
        when(typePieceJointeRepository.findByAgenceIdOrAgenceIsNullOrderByLibelleAsc(7L))
                .thenReturn(List.of(systemType, override));

        assertThat(service.listTypes(7L, false)).isEmpty();
        assertThat(service.listTypes(7L, true))
                .singleElement()
                .satisfies(type -> {
                    assertThat(type.getId()).isEqualTo(2L);
                    assertThat(type.getSysteme()).isFalse();
                    assertThat(type.getActif()).isFalse();
                });
    }

    @Test
    void travelAssistanceOnlyReceivesTravelAndSharedAssistanceTypes() {
        BrancheAssurance assistanceBranch = BrancheAssurance.builder()
                .code("ASSISTANCE")
                .libelle("Assistance")
                .build();
        assistanceBranch.setId(3L);
        Contrat contrat = Contrat.builder()
                .brancheAssurance(assistanceBranch)
                .typeContrat(TypeContrat.PARTICULIER)
                .clients(new ArrayList<>())
                .build();
        contrat.setId(11L);
        ProduitAssistance product = ProduitAssistance.builder()
                .type("Assistance Voyage")
                .build();
        AssistanceContrat assistance = AssistanceContrat.builder()
                .produitAssistance(product)
                .actif(true)
                .build();
        TypePieceJointe shared = type(1L, assistanceBranch, null, "Identité");
        TypePieceJointe travel = type(2L, assistanceBranch, TypeAssistance.VOYAGE, "Passeport");
        TypePieceJointe automobile = type(3L, assistanceBranch, TypeAssistance.AUTOMOBILE, "Carte grise");

        when(contratRepository.findByAgenceIdAndId(7L, 11L)).thenReturn(Optional.of(contrat));
        when(mouvementContratRepository.findFirstByContratIdOrderByCreatedAtDesc(11L)).thenReturn(Optional.empty());
        when(assistanceContratRepository.findByContratIdAndActifTrueOrderByCreatedAtDesc(11L))
                .thenReturn(List.of(assistance));
        when(typePieceJointeRepository.findByAgenceIdOrAgenceIsNullOrderByLibelleAsc(7L))
                .thenReturn(List.of(shared, travel, automobile));
        when(pieceJointeRepository.findByContratIdAndMouvementContratIsNullOrderByCreatedAtDesc(11L))
                .thenReturn(List.of());

        assertThat(service.listContratPieces(7L, 11L, null).getTypes())
                .extracting(type -> type.getLibelle())
                .containsExactly("Identité", "Passeport");
    }

    private TypePieceJointe type(
            Long id,
            BrancheAssurance branch,
            TypeAssistance assistanceType,
            String label
    ) {
        TypePieceJointe type = TypePieceJointe.builder()
                .libelle(label)
                .brancheAssurance(branch)
                .typeAssistance(assistanceType)
                .obligatoire(false)
                .actif(true)
                .build();
        type.setId(id);
        return type;
    }

    @Test
    void clientDocumentsNeverReadAnotherAgencyClient() {
        when(clientRepository.findByAgenceIdAndId(7L, 42L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.clientDocuments(7L, 42L))
                .isInstanceOf(com.assurance.exception.ResourceNotFoundException.class);
        verify(pieceJointeRepository, never()).findByAgenceIdAndClientIdOrderByCreatedAtDesc(any(), any());
    }

    @Test
    void clientStorageUsesTheSharedAgencyRootWithoutChangingLegacyContractPaths(@TempDir Path folder) {
        StorageLayoutService layout = new StorageLayoutService();
        ReflectionTestUtils.setField(layout, "root", folder);
        assertThat(layout.resolveClientDocument(Path.of("7/clients/42/cin.pdf")))
                .isEqualTo(folder.resolve("agencies/7/clients/42/documents/cin.pdf"));
        assertThat(layout.resolveContractAttachment(Path.of("7/11/mouvement-2/cin.pdf")))
                .isEqualTo(folder.resolve("agencies/7/contracts/11/attachments/mouvement-2/cin.pdf"));
        assertThatThrownBy(() -> layout.resolveClientDocument(Path.of("../7/clients/42/cin.pdf")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void cannotDeleteAnotherClientsFile() {
        var client = com.assurance.entity.Client.builder().build();
        client.setId(99L);
        PieceJointe piece = PieceJointe.builder().client(client).build();
        when(pieceJointeRepository.lockOwned(7L, 15L)).thenReturn(Optional.of(piece));
        assertThatThrownBy(() -> service.deleteClientDocument(7L, 42L, 15L))
                .isInstanceOf(com.assurance.exception.ResourceNotFoundException.class);
        verify(pieceJointeRepository, never()).delete(any());
    }

    @Test
    void usedClientDocumentIsArchivedWithoutDeletingItsFile() {
        var client = com.assurance.entity.Client.builder().build();
        client.setId(42L);
        PieceJointe piece = PieceJointe.builder().client(client).cheminStockage("7/clients/42/cin.pdf").build();
        piece.setId(15L);
        when(pieceJointeRepository.lockOwned(7L, 15L)).thenReturn(Optional.of(piece));
        when(documentUsageRepository.existsByPieceId(15L)).thenReturn(true);
        service.deleteClientDocument(7L, 42L, 15L);
        assertThat(piece.getArchived()).isTrue();
        assertThat(piece.getArchivedAt()).isNotNull();
        verify(pieceJointeRepository, never()).delete(any());
        verify(storageLayoutService, never()).resolveContractAttachment(any());
    }

    @Test
    void unusedUploadCanBePermanentlyRemoved(@TempDir Path folder) throws Exception {
        var client = com.assurance.entity.Client.builder().build();
        client.setId(42L);
        PieceJointe piece = PieceJointe.builder().client(client).cheminStockage("7/clients/42/cin.pdf").build();
        piece.setId(15L);
        Path file = folder.resolve("cin.pdf");
        Files.writeString(file, "test");
        when(pieceJointeRepository.lockOwned(7L, 15L)).thenReturn(Optional.of(piece));
        when(storageLayoutService.resolveClientDocument(any())).thenReturn(file);
        service.deleteClientDocument(7L, 42L, 15L);
        verify(pieceJointeRepository).delete(piece);
        assertThat(file).doesNotExist();
    }

    @Test
    void expiredAndArchivedVersionsAreNotProposedForReuse() {
        PieceJointe expired = PieceJointe.builder().expiresOn(java.time.LocalDate.now().minusDays(1)).build();
        PieceJointe valid = PieceJointe.builder().expiresOn(java.time.LocalDate.now()).build();
        PieceJointe archived = PieceJointe.builder().archived(true).build();
        assertThat((Boolean) ReflectionTestUtils.invokeMethod(service, "isAvailable", expired)).isFalse();
        assertThat((Boolean) ReflectionTestUtils.invokeMethod(service, "isAvailable", archived)).isFalse();
        assertThat((Boolean) ReflectionTestUtils.invokeMethod(service, "isAvailable", valid)).isTrue();
    }

    @Test
    void requiredExpiryIsValidatedOnTheServer() {
        var policy = new com.assurance.entity.DocumentPolicy();
        policy.setExpiry(com.assurance.enums.DocumentExpiry.REQUIRED);
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(service, "validateExpiry", policy, null))
                .isInstanceOf(com.assurance.exception.BadRequestException.class);
    }

    @Test
    void validityComesFromTheHolderInformationAndDoesNotRewriteOlderSnapshots() {
        var policy = new com.assurance.entity.DocumentPolicy();
        policy.setValiditySource(com.assurance.enums.DocumentValiditySource.CLIENT_CIN);
        var client = com.assurance.entity.Client.builder().cinValidite(java.time.LocalDate.of(2030, 5, 12)).build();
        PieceJointe previous = PieceJointe.builder().expiresOn(java.time.LocalDate.of(2025, 5, 12)).build();
        java.time.LocalDate expiry = ReflectionTestUtils.invokeMethod(service, "resolveExpiry", policy, client, null,
                java.time.LocalDate.of(2099, 1, 1));
        assertThat(expiry).isEqualTo(client.getCinValidite());
        assertThat(previous.getExpiresOn()).isEqualTo(java.time.LocalDate.of(2025, 5, 12));
        policy.setValiditySource(com.assurance.enums.DocumentValiditySource.VEHICULE_CARTE_GRISE);
        var vehicle = com.assurance.entity.Vehicule.builder().dateExpirationCarteGrise(java.time.LocalDate.of(2028, 7, 10)).build();
        expiry = ReflectionTestUtils.invokeMethod(service, "resolveExpiry", policy, null, vehicle, null);
        assertThat(expiry).isEqualTo(vehicle.getDateExpirationCarteGrise());
    }

    @Test
    void fakePdfIsRejectedBeforeStorage() {
        var file = new MockMultipartFile("files", "cin.pdf", "application/pdf", "not a PDF".getBytes(StandardCharsets.UTF_8));
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(service, "validateFiles", List.of(file)))
                .isInstanceOf(com.assurance.exception.BadRequestException.class);
        verify(storageLayoutService, never()).resolveContractAttachment(any());
    }

    @Test
    void replacingClientDocumentKeepsOldReferenceAndCreatesNewVersion(@TempDir Path folder) throws Exception {
        Agence agence = Agence.builder().build();
        agence.setId(7L);
        var client = com.assurance.entity.Client.builder().agence(agence)
                .typeClient(com.assurance.enums.TypeClient.PERSONNE_PHYSIQUE)
                .cinValidite(java.time.LocalDate.of(2031, 5, 12)).build();
        client.setId(42L);
        var nature = com.assurance.entity.NaturePieceJointe.builder().libelle("CIN")
                .defaultOwner(com.assurance.enums.DocumentOwner.CLIENT)
                .defaultValiditySource(com.assurance.enums.DocumentValiditySource.CLIENT_CIN)
                .defaultExpiry(com.assurance.enums.DocumentExpiry.OPTIONAL).build();
        nature.setId(1L);
        TypePieceJointe type = type(1L, null, null, "CIN");
        type.setNaturePieceJointe(nature);
        PieceJointe previous = PieceJointe.builder().agence(agence).client(client).typePieceJointe(type)
                .documentOwner(com.assurance.enums.DocumentOwner.CLIENT).expiresOn(java.time.LocalDate.of(2024, 5, 12))
                .cheminStockage("old/cin.pdf").build();
        previous.setId(15L);
        when(clientRepository.findByAgenceIdAndId(7L, 42L)).thenReturn(Optional.of(client));
        when(typePieceJointeRepository.findByAgenceIdOrAgenceIsNullOrderByLibelleAsc(7L)).thenReturn(List.of(type));
        when(pieceJointeRepository.lockOwned(7L, 15L)).thenReturn(Optional.of(previous));
        when(storageLayoutService.resolveClientDocument(any())).thenAnswer(call -> folder.resolve(call.getArgument(0, Path.class)));
        when(pieceJointeRepository.save(any())).thenAnswer(call -> {
            PieceJointe piece = call.getArgument(0);
            piece.setId(16L);
            return piece;
        });
        byte[] bytes;
        try (var pdf = new org.apache.pdfbox.pdmodel.PDDocument(); var output = new java.io.ByteArrayOutputStream()) {
            pdf.addPage(new org.apache.pdfbox.pdmodel.PDPage());
            pdf.save(output);
            bytes = output.toByteArray();
        }
        PieceJointeResponse response = service.uploadClient(7L, 42L, 1L,
                List.of(new MockMultipartFile("files", "new-cin.pdf", "application/pdf", bytes)),
                java.time.LocalDate.now().plusYears(5), 15L, "Renouvellement");
        assertThat(previous.getArchived()).isTrue();
        assertThat(previous.getCheminStockage()).isEqualTo("old/cin.pdf");
        assertThat(previous.getExpiresOn()).isEqualTo(java.time.LocalDate.of(2024, 5, 12));
        assertThat(response.getExpiresOn()).isEqualTo(client.getCinValidite());
        assertThat(response.getPreviousVersionId()).isEqualTo(15L);
        assertThat(response.getClientId()).isEqualTo(42L);
        assertThat(response.getContratId()).isNull();
        assertThat(response.getChangeReason()).isEqualTo("Renouvellement");
        verify(pieceJointeRepository, never()).delete(any());
    }
}
