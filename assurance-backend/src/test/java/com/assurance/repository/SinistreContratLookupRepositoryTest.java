package com.assurance.repository;

import com.assurance.entity.Agence;
import com.assurance.entity.BrancheAssurance;
import com.assurance.entity.Contrat;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.MouvementVehicule;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.enums.CategorieMouvementContrat;
import com.assurance.enums.NatureSnapshotMouvement;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.enums.TypeContrat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(showSql = false, properties = {
        "spring.datasource.url=jdbc:h2:mem:claims-contract-lookup;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect"
})
class SinistreContratLookupRepositoryTest {

    @Autowired
    private SinistreContratLookupRepository repository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void findsPastAndCurrentPolicyPeriodsButNeverAnotherAgencyBranchOrDraft() {
        var agency = agency("LOOKUP-1");
        var otherAgency = agency("LOOKUP-2");
        var branch = branch("AUTO-LOOKUP");
        var otherBranch = branch("RD-LOOKUP");
        var old = contract(agency, branch, 2025);
        var current = contract(agency, branch, 2026);
        contract(otherAgency, branch, 2026);
        contract(agency, otherBranch, 2026);
        var draft = contract(agency, branch, 2026);
        draft.setBrouillon(true);
        entityManager.flush();

        assertThat(repository.search(agency.getId(), branch.getId(), "POLICE", "000123", PageRequest.of(0, 20)))
                .extracting(Contrat::getId).containsExactly(current.getId(), old.getId());
    }

    @Test
    void registrationLookupUsesValidatedHistoricalSnapshotsNotJustCurrentVehicleData() {
        var agency = agency("LOOKUP-HIST");
        var branch = branch("AUTO-HIST");
        var contract = contract(agency, branch, 2025);
        var type = entityManager.persist(TypeMouvementContrat.builder().code("CLAIM-AN")
                .libelle("Affaire nouvelle").categorie(CategorieMouvementContrat.AFFAIRE_NOUVELLE).build());
        var movement = entityManager.persist(MouvementContrat.builder().agence(agency).contrat(contract)
                .typeMouvement(type).statut(StatutMouvementContrat.VALIDE).dateEffet(contract.getDateEffet())
                .dateEcheance(contract.getDateEcheance()).build());
        entityManager.persist(MouvementVehicule.builder().mouvementContrat(movement)
                .nature(NatureSnapshotMouvement.AJOUT).immatriculation("OLD-123-A").build());
        entityManager.flush();

        assertThat(repository.search(agency.getId(), branch.getId(), "IMMATRICULATION", "old123a", PageRequest.of(0, 20)))
                .extracting(Contrat::getId).containsExactly(contract.getId());
        movement.setStatut(StatutMouvementContrat.BROUILLON);
        entityManager.flush();
        assertThat(repository.search(agency.getId(), branch.getId(), "IMMATRICULATION", "old123a", PageRequest.of(0, 20))).isEmpty();
    }

    private Agence agency(String code) {
        return entityManager.persist(Agence.builder().code(code).nom(code).build());
    }

    private BrancheAssurance branch(String code) {
        return entityManager.persist(BrancheAssurance.builder().code(code).libelle(code).build());
    }

    private Contrat contract(Agence agency, BrancheAssurance branch, int year) {
        return entityManager.persist(Contrat.builder().agence(agency).brancheAssurance(branch)
                .brouillon(false).prospection(false)
                .typeContrat(TypeContrat.PARTICULIER).statut(StatutContrat.ACTIVE)
                .numeroPolice("000123").dateEffet(LocalDate.of(year, 1, 1))
                .dateEcheance(LocalDate.of(year, 12, 31)).build());
    }
}
