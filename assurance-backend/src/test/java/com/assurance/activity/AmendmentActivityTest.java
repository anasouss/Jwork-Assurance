package com.assurance.activity;

import com.assurance.dto.request.AvenantDraftContext;
import com.assurance.dto.request.AvenantRequest;
import com.assurance.dto.request.CreateContratRequest;
import com.assurance.entity.Contrat;
import com.assurance.entity.Vehicule;
import com.assurance.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AmendmentActivityTest {
    private final AmendmentActivity mapper = new AmendmentActivity(null, null, null, null, null, null, null, null);

    @Test
    void selectedTargetsUseContractLabelsAndSelectionOrderIsNotAModification() {
        Contrat contract = Contrat.builder().build();
        Vehicule first = Vehicule.builder().immatriculation("5776-A-70").build();
        first.setId(969L);
        Vehicule second = Vehicule.builder().immatriculation("WW973221").build();
        second.setId(954L);
        contract.setVehicules(List.of(first, second));
        AvenantRequest request = new AvenantRequest();
        request.setVehiculeIds(List.of(969L, 954L));
        var before = mapper.snapshot(request, contract);
        request.setVehiculeIds(List.of(954L, 969L));

        assertThat(ActivityValues.changes(before, mapper.snapshot(request, contract))).isEmpty();
        assertThat(before).containsEntry("Vehicules selectionnes", "5776-A-70, WW973221");
    }

    @Test
    void fullPayloadComparisonDoesNotDiscardChangesOutsideTheClickedSection() {
        AvenantRequest request = new AvenantRequest();
        request.setNumeroBonCommande("121");
        var vehicle = new CreateContratRequest.VehiculeInput();
        vehicle.setImmatriculation("5776-A-70");
        vehicle.setMontantCredit(new BigDecimal("5000"));
        request.setVehicules(List.of(vehicle));
        Contrat contract = Contrat.builder().build();
        var before = mapper.snapshot(request, contract);
        request.setNumeroBonCommande("122");
        vehicle.setMontantCredit(new BigDecimal("6000"));

        assertThat(ActivityValues.changes(before, mapper.snapshot(request, contract)))
                .containsExactly(new ActivityChange("Bon de commande", "121", "122"),
                        new ActivityChange("Vehicule 1 - Montant du credit", "5 000,00", "6 000,00"));
    }

    @Test
    void targetContextIsValidatedAndCannotBePassedForWholeDraftSave() {
        AvenantRequest request = new AvenantRequest();
        var context = new AvenantDraftContext();
        context.setIntent(AvenantDraftContext.Intent.SAVE_TARGET);
        context.setTargetKind(AvenantDraftContext.TargetKind.VEHICULE);
        context.setSection(AvenantDraftContext.Section.GARANTIES);
        context.setTargetIndex(0);
        context.validate(request, 1, 0);
        assertThat(context.title()).contains("garanties du vehicule 1");
        context.setTargetIndex(1);
        assertThatThrownBy(() -> context.validate(request, 1, 0)).isInstanceOf(BadRequestException.class);
        context.setIntent(AvenantDraftContext.Intent.PREPARE_VALIDATION);
        assertThatThrownBy(() -> context.validate(request, 1, 0)).isInstanceOf(BadRequestException.class);
    }
}
