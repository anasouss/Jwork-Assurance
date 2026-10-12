package com.assurance.service;

import com.assurance.entity.Contrat;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.enums.MotifBlocageModificationContrat;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.StatutMouvementContrat;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ContractDirectModificationPolicyTest {

    @Test
    void blocksDirectModificationWhenAnActivePaymentExists() {
        Contrat contract = contract(12L, StatutContrat.ACTIVE, false);

        var result = ContractDirectModificationPolicy.evaluateState(
                contract,
                List.of(initialMovement(contract)),
                true,
                false
        );

        assertThat(result.allowed()).isFalse();
        assertThat(result.reason()).isEqualTo(MotifBlocageModificationContrat.REGLEMENT_EXISTANT);
    }

    @Test
    void blocksDirectModificationWhenALaterMovementExists() {
        Contrat contract = contract(13L, StatutContrat.ACTIVE, false);
        MouvementContrat amendment = movement(contract, "MOG_M");

        var result = ContractDirectModificationPolicy.evaluateState(
                contract,
                List.of(initialMovement(contract), amendment),
                false,
                false
        );

        assertThat(result.allowed()).isFalse();
        assertThat(result.reason()).isEqualTo(MotifBlocageModificationContrat.MOUVEMENT_ULTERIEUR);
    }

    @Test
    void keepsAnUnissuedDraftDirectlyEditable() {
        Contrat contract = contract(14L, StatutContrat.DRAFT, true);

        var result = ContractDirectModificationPolicy.evaluateState(contract, List.of(), false, false);

        assertThat(result.allowed()).isTrue();
        assertThat(result.reason()).isNull();
    }

    private Contrat contract(Long id, StatutContrat status, boolean draft) {
        Contrat contract = Contrat.builder()
                .statut(status)
                .brouillon(draft)
                .prospection(false)
                .renouvele(false)
                .build();
        contract.setId(id);
        return contract;
    }

    private MouvementContrat initialMovement(Contrat contract) {
        return movement(contract, "AN");
    }

    private MouvementContrat movement(Contrat contract, String code) {
        return MouvementContrat.builder()
                .contrat(contract)
                .typeMouvement(TypeMouvementContrat.builder().code(code).build())
                .statut(StatutMouvementContrat.VALIDE)
                .build();
    }
}
