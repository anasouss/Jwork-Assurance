package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.BrancheAssurance;
import com.assurance.entity.Contrat;
import com.assurance.entity.ProduitAssistance;
import com.assurance.entity.TypePieceJointe;
import com.assurance.enums.TypeAssistance;
import com.assurance.enums.TypeContrat;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.BrancheAssuranceRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.PieceJointeRepository;
import com.assurance.repository.TypeMouvementContratRepository;
import com.assurance.repository.TypePieceJointeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PieceJointeServiceTest {

    @Mock private ContratRepository contratRepository;
    @Mock private AgenceRepository agenceRepository;
    @Mock private MouvementContratRepository mouvementContratRepository;
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
                typeMouvementContratRepository,
                typePieceJointeRepository,
                pieceJointeRepository,
                assistanceContratRepository,
                brancheAssuranceRepository,
                storageLayoutService
        );
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
