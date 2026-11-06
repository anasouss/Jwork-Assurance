package com.assurance.activity;

import com.assurance.dto.response.ContratResponse;
import com.assurance.enums.TypeContrat;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ContractActivityTest {
    @Test
    void oneContractEventRetainsItsChildrenAsBusinessContext() {
        ContratResponse contract = contract();
        contract.setClients(List.of(ContratResponse.ClientLink.builder().clientId(57L)
                .role("SOUSCRIPTEUR").nomAffichage("Mohamed Boukha").build()));
        contract.setVehicules(List.of(ContratResponse.VehiculeView.builder().vehiculeId(969L)
                .immatriculation("5776-A-70").build()));
        contract.setGaranties(List.of(ContratResponse.GarantieView.builder().garantieId(1L)
                .libelle("Responsabilite civile").code("RC").vehiculeId(969L).build()));
        var command = ContractActivity.command(null, contract, ActivityAction.CREATED,
                "Contrat cree", "CONTRACT_CREATION");

        assertThat(command.subject().type()).isEqualTo(ActivityRecordType.CONTRAT);
        assertThat(command.references()).extracting(ActivityReference::type)
                .contains(ActivityRecordType.CLIENT, ActivityRecordType.VEHICULE, ActivityRecordType.GARANTIE);
        assertThat(command.changes()).extracting(ActivityChange::label)
                .anyMatch(label -> label.contains("Responsabilite civile (5776-A-70)"));
    }

    @Test
    void noOpProducesNoBusinessEvent() {
        ContratResponse contract = contract();
        assertThat(ContractActivity.command(contract, contract, ActivityAction.SAVED,
                "Dossier enregistre", "CONTRACT_DRAFT_SAVE").changes()).isEmpty();
    }

    @Test
    void replacementOfTechnicalGuaranteeRowIdentityIsNotAUserChange() {
        ContratResponse before = contract();
        ContratResponse after = contract();
        before.setGaranties(List.of(ContratResponse.GarantieView.builder().contratGarantieId(1L)
                .garantieId(7L).libelle("Defense et recours").code("DR").build()));
        after.setGaranties(List.of(ContratResponse.GarantieView.builder().contratGarantieId(2L)
                .garantieId(7L).libelle("Defense et recours").code("DR").build()));

        assertThat(ContractActivity.command(before, after, ActivityAction.SAVED,
                "Garanties enregistrees", "CONTRACT_GUARANTEES_SAVE").changes()).isEmpty();
    }

    private ContratResponse contract() {
        return ContratResponse.builder().id(99L).agenceId(1L).numeroDossier("MATU26-0026")
                .typeContrat(TypeContrat.CONVENTION).brouillon(true).build();
    }

    @Test
    void catalogAndFinancialChangesAreReadableAndNotHiddenByStableContractId() {
        ContratResponse before = contract();
        before.setCompagnieAssuranceNom("MATU");
        before.setGrilleTarifaireLibelle("Grille initiale");
        ContratResponse after = contract();
        after.setCompagnieAssuranceNom("ATLANTASANAD");
        after.setGrilleTarifaireLibelle("Grille revisee");
        after.setQuittanceGenerale(com.assurance.dto.response.QuittanceResponse.builder()
                .primeTotale(new java.math.BigDecimal("1257.38")).build());

        assertThat(ContractActivity.command(before, after, ActivityAction.UPDATED,
                "Contrat modifie", "CONTRACT_UPDATE").changes()).contains(
                new ActivityChange("Compagnie", "MATU", "ATLANTASANAD"),
                new ActivityChange("Grille tarifaire", "Grille initiale", "Grille revisee"),
                new ActivityChange("Quittance - Montant TTC", null, "1 257,38"));
    }

    @Test
    void sameLabelRelationshipChangesKeepOldReferencesAndClientRoles() {
        ContratResponse before = contract();
        ContratResponse after = contract();
        before.setCompagnieAssuranceId(4L);
        after.setCompagnieAssuranceId(5L);
        before.setCompagnieAssuranceNom("Compagnie Atlas");
        after.setCompagnieAssuranceNom("Compagnie Atlas");
        before.setClients(List.of(
                ContratResponse.ClientLink.builder().clientId(57L).role("SOUSCRIPTEUR").nomAffichage("Mohamed").build(),
                ContratResponse.ClientLink.builder().clientId(58L).role("PROPRIETAIRE").nomAffichage("Mohamed").build()));
        after.setClients(List.of(
                ContratResponse.ClientLink.builder().clientId(58L).role("SOUSCRIPTEUR").nomAffichage("Mohamed").build(),
                ContratResponse.ClientLink.builder().clientId(57L).role("PROPRIETAIRE").nomAffichage("Mohamed").build()));

        var command = ContractActivity.command(before, after, ActivityAction.SAVED, "Dossier enregistre", "CONTRACT_DRAFT_SAVE");

        assertThat(command.changes()).extracting(ActivityChange::label).contains("Compagnie", "Souscripteur", "Proprietaire");
        assertThat(command.references()).filteredOn(reference -> reference.type() == ActivityRecordType.COMPAGNIE)
                .extracting(ActivityReference::id).containsExactly("4", "5");
    }

    @Test
    void rebuildingDraftTargetsAndAssistanceRowsDoesNotInventBusinessChanges() {
        ContratResponse before = contract();
        ContratResponse after = contract();
        before.setVehicules(List.of(ContratResponse.VehiculeView.builder().vehiculeId(1L).immatriculation("5776-A-70").marqueId(4L).build()));
        after.setVehicules(List.of(ContratResponse.VehiculeView.builder().vehiculeId(2L).immatriculation("5776-A-70").marqueId(4L).build()));
        before.setGaranties(List.of(ContratResponse.GarantieView.builder().contratGarantieId(10L).garantieId(7L)
                .libelle("Defense et recours").code("DR").vehiculeId(1L).ligneGrilleTarifaireId(30L).build()));
        after.setGaranties(List.of(ContratResponse.GarantieView.builder().contratGarantieId(11L).garantieId(7L)
                .libelle("Defense et recours").code("DR").vehiculeId(2L).ligneGrilleTarifaireId(30L).build()));
        before.setAssistances(List.of(com.assurance.dto.response.AssistanceContratResponse.builder().id(20L).vehiculeId(1L)
                .vehiculeImmatriculation("5776-A-70").compagnieAssistanceId(6L).produitAssistanceId(8L).tarifProduitAssistanceId(9L)
                .elementFacturableId(40L).produit("Premium").build()));
        after.setAssistances(List.of(com.assurance.dto.response.AssistanceContratResponse.builder().id(21L).vehiculeId(2L)
                .vehiculeImmatriculation("5776-A-70").compagnieAssistanceId(6L).produitAssistanceId(8L).tarifProduitAssistanceId(9L)
                .elementFacturableId(41L).produit("Premium").build()));

        assertThat(ContractActivity.changes(before, after)).isEmpty();
    }
}
