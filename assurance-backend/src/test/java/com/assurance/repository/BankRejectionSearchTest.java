package com.assurance.repository;

import com.assurance.entity.Agence;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.ReglementClient;
import com.assurance.entity.Role;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.StatutInstrumentReglement;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:bank-rejections;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect"
})
class BankRejectionSearchTest {
    @Autowired
    private InstrumentReglementClientRepository repository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void filtersByRejectionDateNotChequeDateAndKeepsResolvedHistoryWithinAgency() {
        Agence agency = entityManager.persist(Agence.builder().code("REJECT-1").nom("Agency one").build());
        Agence other = entityManager.persist(Agence.builder().code("REJECT-2").nom("Agency two").build());
        LocalDate rejectedOn = LocalDate.of(2026, 10, 20);
        var replaced = instrument(agency, "CH-001", StatutInstrumentReglement.REMPLACE, rejectedOn);
        var represented = instrument(agency, "CH-002", StatutInstrumentReglement.EN_ATTENTE, rejectedOn);
        instrument(other, "CH-001", StatutInstrumentReglement.REJETE, rejectedOn);
        instrument(agency, "CH-003", StatutInstrumentReglement.REJETE, rejectedOn.minusDays(1));
        instrument(agency, "CH-004", StatutInstrumentReglement.EN_ATTENTE, null);
        entityManager.flush();
        entityManager.clear();

        assertThat(search(agency.getId(), rejectedOn, null)).extracting(InstrumentReglementClient::getId)
                .containsExactly(represented.getId(), replaced.getId());
        assertThat(search(agency.getId(), rejectedOn, "REMPLACE")).extracting(InstrumentReglementClient::getId)
                .containsExactly(replaced.getId());
        assertThat(search(agency.getId(), rejectedOn, "REPRESENTE")).extracting(InstrumentReglementClient::getId)
                .containsExactly(represented.getId());
        assertThat(search(agency.getId(), rejectedOn, "A_TRAITER")).isEmpty();
    }

    @Test
    void searchesChequeReferencesAndExcludesUnrelatedReplacedInstruments() {
        Agence agency = entityManager.persist(Agence.builder().code("REJECT-SEARCH").nom("Agency").build());
        var rejected = instrument(agency, "CHEQUE-ABC", StatutInstrumentReglement.REJETE, LocalDate.of(2026, 10, 20));
        instrument(agency, "CHEQUE-OLD", StatutInstrumentReglement.REMPLACE, null);
        entityManager.flush();
        var result = repository.searchBankRejections(agency.getId(), ModeReglementClient.CHEQUE, null,
                null, null, null, null, null, "abc", PageRequest.of(0, 25));
        assertThat(result.getContent()).extracting(InstrumentReglementClient::getId).containsExactly(rejected.getId());
        assertThat(repository.searchBankRejections(agency.getId(), ModeReglementClient.EFFET, null,
                null, null, null, null, null, null, PageRequest.of(0, 25))).isEmpty();
    }

    private List<InstrumentReglementClient> search(Long agencyId, LocalDate date, String resolution) {
        return repository.searchBankRejections(agencyId, null, null, date, date, null, null,
                resolution, null, PageRequest.of(0, 25)).getContent();
    }

    private InstrumentReglementClient instrument(Agence agency, String reference, StatutInstrumentReglement status, LocalDate rejectionDate) {
        Role role = entityManager.persist(Role.builder().agence(agency).code(reference).nom("Operator").build());
        Utilisateur operator = entityManager.persist(Utilisateur.builder().agence(agency).role(role)
                .email(agency.getCode() + reference + "@example.test").password("not-used").prenom("Test").nom("Operator").build());
        ReglementClient payment = entityManager.persist(ReglementClient.builder().agence(agency)
                .numero(reference).dateReglement(LocalDate.of(2026, 9, 1)).payeurNom("Test payer")
                .montantTotal(new BigDecimal("100.00")).montantNonAffecte(BigDecimal.ZERO).creePar(operator).build());
        return entityManager.persist(InstrumentReglementClient.builder().agence(agency).reglement(payment)
                .mode(ModeReglementClient.CHEQUE).statut(status).montant(new BigDecimal("100.00"))
                .referenceInstrument(reference).dateInstrument(LocalDate.of(2026, 9, 1))
                .dateEcheance(LocalDate.of(2026, 9, 15)).dateStatut(LocalDate.of(2026, 10, 25))
                .dateRejet(rejectionDate).motifRejet(rejectionDate == null ? null : "Sans provision").build());
    }
}
