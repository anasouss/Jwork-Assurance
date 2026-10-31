package com.assurance.service;

import com.assurance.dto.request.AvenantRequest;
import com.assurance.entity.Contrat;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.Quittance;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.enums.CategorieMouvementContrat;
import com.assurance.repository.ApplicationRegleFiscaleQuittanceRepository;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.ElementFacturableCibleRepository;
import com.assurance.repository.ElementFacturableRepository;
import com.assurance.repository.LigneQuittanceRepository;
import com.assurance.repository.MouvementVehiculeRepository;
import com.assurance.repository.QuittanceRepository;
import com.assurance.repository.VehiculeRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class QuittanceProductionStatementLabelTest {
    private final ElementFacturableRepository elements = mock(ElementFacturableRepository.class);
    private final QuittanceRepository quittances = mock(QuittanceRepository.class);
    private final QuittanceProductionService service = new QuittanceProductionService(
            mock(QuittanceCalculService.class), elements, mock(ElementFacturableCibleRepository.class),
            quittances, mock(LigneQuittanceRepository.class), mock(ApplicationRegleFiscaleQuittanceRepository.class),
            mock(ElementFacturableCibleService.class), mock(TiersCompagnieService.class));
    private final Contrat contract = Contrat.builder().numeroContrat("C-1").libelleReleve("Original contract label").build();
    private final TypeMouvementContrat type = TypeMouvementContrat.builder().code("EXG_M")
            .libelle("Extension garanties").categorie(CategorieMouvementContrat.AVENANT).build();
    private final MouvementContrat movement = MouvementContrat.builder().contrat(contract).typeMouvement(type).build();
    private final QuittanceCalculService.Resultat amounts = new QuittanceCalculService.Resultat(
            List.of(), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);

    @BeforeEach
    void repositories() {
        movement.setId(10L);
        when(elements.save(any())).thenAnswer(call -> call.getArgument(0));
        when(quittances.save(any())).thenAnswer(call -> call.getArgument(0));
    }

    @Test
    void customAvenantLabelIsCopiedWithoutChangingTheContract() {
        movement.setLibelleReleve("  Custom\navenant label  ");
        ElementFacturable element = generate();
        assertThat(element.getLibelleReleve()).isEqualTo("Custom avenant label");
        assertThat(element.getLibelle()).isEqualTo("Extension garanties");
        assertThat(contract.getLibelleReleve()).isEqualTo("Original contract label");
    }

    @Test
    void blankAvenantLabelUsesTheGeneratedLabelRatherThanTheOriginalContractOverride() {
        movement.setLibelleReleve(" \n ");
        assertThat(generate().getLibelleReleve()).isNull();
        movement.setLibelleReleve(null);
        assertThat(generate().getLibelleReleve()).isNull();
    }

    @Test
    void newBusinessKeepsItsExistingContractLabelBehavior() {
        type.setCategorie(CategorieMouvementContrat.AFFAIRE_NOUVELLE);
        assertThat(generate().getLibelleReleve()).isEqualTo("Original contract label");
    }

    @Test
    void recalculationKeepsTheMovementLabelAndAllowsExplicitRemoval() {
        ElementFacturable element = ElementFacturable.builder().libelleReleve("Old label").build();
        element.setId(20L);
        Quittance receipt = Quittance.builder().elementFacturable(element).build();
        receipt.setId(30L);
        when(quittances.findFirstByMouvementContratIdOrderByCreatedAtAsc(10L)).thenReturn(Optional.of(receipt));
        movement.setLibelleReleve("New label");
        service.remplacerPourMouvement(contract, movement, type, amounts, List.of(), List.of(), List.of());
        assertThat(element.getLibelleReleve()).isEqualTo("New label");
        movement.setLibelleReleve(null);
        service.remplacerPourMouvement(contract, movement, type, amounts, List.of(), List.of(), List.of());
        assertThat(element.getLibelleReleve()).isNull();
    }

    @Test
    void draftJsonRoundTripKeepsTheOptionalLabelAndOldDraftsRemainReadable() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        AvenantRequest request = new AvenantRequest();
        request.setCodeTypeMouvement("EXG_M");
        request.setLibelleReleve("Custom draft label");
        assertThat(mapper.readValue(mapper.writeValueAsString(request), AvenantRequest.class).getLibelleReleve())
                .isEqualTo("Custom draft label");
        assertThat(mapper.readValue("{\"codeTypeMouvement\":\"EXG_M\"}", AvenantRequest.class).getLibelleReleve()).isNull();
    }

    @Test
    void newDocumentUsesTheOverrideButIssuedDocumentKeepsItsSnapshot() {
        DocumentClientLineLabelService labels = new DocumentClientLineLabelService(
                mock(AssistanceContratRepository.class), mock(MouvementVehiculeRepository.class), mock(VehiculeRepository.class));
        ElementFacturable element = ElementFacturable.builder().libelleReleve("New avenant label").build();
        LigneDocumentClient line = LigneDocumentClient.builder().elementFacturable(element).build();
        assertThat(labels.label(line, null)).isEqualTo("New avenant label");
        line.setId(1L);
        line.setLibelleDocument("Issued snapshot");
        element.setLibelleReleve("Changed later");
        assertThat(labels.label(line, null)).isEqualTo("Issued snapshot");
    }

    private ElementFacturable generate() {
        return service.genererPourMouvement(contract, movement, type, amounts, List.of(), List.of(), List.of()).getElementFacturable();
    }
}
