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
                storageLayoutService
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
}
