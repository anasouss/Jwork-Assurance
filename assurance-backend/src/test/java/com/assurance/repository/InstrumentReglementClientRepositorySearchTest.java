package com.assurance.repository;

import com.assurance.entity.*;
import com.assurance.enums.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:recorded-instruments;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect"
})
class InstrumentReglementClientRepositorySearchTest {
    @Autowired
    private InstrumentReglementClientRepository repository;

    @Autowired
    private TestEntityManager em;

    @Test
    void returnsOnlyMatchingInstrumentsNotTheirSiblingsOrOtherAgencies() {
        ReglementClient payment = payment("FIRST");
        InstrumentReglementClient match = instrument(payment, "555444", ModeReglementClient.CHEQUE, StatutInstrumentReglement.CONFIRME);
        instrument(payment, "555445", ModeReglementClient.CHEQUE, StatutInstrumentReglement.EN_ATTENTE);
        instrument(payment("OTHER"), "555444", ModeReglementClient.CHEQUE, StatutInstrumentReglement.CONFIRME);
        em.flush();
        var result = repository.searchRecordedReferences(payment.getAgence().getId(), "%555444%", null, null,
                null, null, null, null, PageRequest.of(0, 25));
        assertThat(result.getContent()).containsExactly(match);
        assertThat(result.getTotalElements()).isEqualTo(1);
        assertThat(repository.searchRecordedReferences(payment.getAgence().getId(), "%REG-FIRST%", null, null,
                null, null, null, null, PageRequest.of(0, 25))).isEmpty();
    }

    @Test
    void modeStatusAndDateApplyToTheMatchedInstrumentAndPaymentDate() {
        ReglementClient payment = payment("FILTER");
        payment.setDateReglement(LocalDate.of(2026, 10, 13));
        InstrumentReglementClient match = instrument(payment, "MATCH", ModeReglementClient.CHEQUE, StatutInstrumentReglement.EN_ATTENTE);
        match.setDateEcheance(LocalDate.of(2027, 8, 13));
        instrument(payment, "MATCH", ModeReglementClient.EFFET, StatutInstrumentReglement.CONFIRME);
        em.flush();
        assertThat(repository.searchRecordedReferences(payment.getAgence().getId(), "%match%",
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), ModeReglementClient.CHEQUE,
                StatutInstrumentReglement.EN_ATTENTE, null, null, PageRequest.of(0, 25)).getContent()).containsExactly(match);
        assertThat(repository.searchRecordedReferences(payment.getAgence().getId(), "%match%", null, null,
                ModeReglementClient.CHEQUE, StatutInstrumentReglement.CONFIRME, null, null, PageRequest.of(0, 25))).isEmpty();
    }

    @Test
    void includesCancelledAndReplacedRecordsAndPaginatesIndividualInstruments() {
        ReglementClient payment = payment("CANCELLED");
        payment.setStatut(StatutReglementClient.ANNULE);
        InstrumentReglementClient first = instrument(payment, "REF_1", ModeReglementClient.CHEQUE, StatutInstrumentReglement.REMPLACE);
        InstrumentReglementClient second = instrument(payment, "REF_2", ModeReglementClient.CHEQUE, StatutInstrumentReglement.CONFIRME);
        em.flush();
        var page = repository.searchRecordedReferences(payment.getAgence().getId(), "%ref!_%", null, null,
                null, null, null, null, PageRequest.of(1, 1, Sort.by("reglement.dateReglement").and(Sort.by("id"))));
        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent()).containsExactly(second);
        assertThat(repository.searchRecordedReferences(payment.getAgence().getId(), "%ref!_1%", null, null,
                null, null, null, null, PageRequest.of(0, 25)).getContent()).containsExactly(first);
    }

    @Test
    void multiClientPayerFilterUsesTheAllocationOfThisInstrumentNotASibling() {
        ReglementClient payment = payment("MULTI");
        payment.setMultiPayeur(true);
        Client client = em.persist(Client.builder().agence(payment.getAgence()).typeClient(TypeClient.PERSONNE_PHYSIQUE)
                .codeClient("C-REF").nom("Client").prenom("Test").build());
        InstrumentReglementClient allocated = instrument(payment, "SHARED", ModeReglementClient.CHEQUE, StatutInstrumentReglement.EN_ATTENTE);
        instrument(payment, "SHARED", ModeReglementClient.CHEQUE, StatutInstrumentReglement.EN_ATTENTE);
        em.persist(AffectationReglementClient.builder().instrument(allocated).clientPayeur(client)
                .payeurNomSnapshot("Client Test").montant(BigDecimal.TEN).statut(StatutAffectationReglement.EN_ATTENTE).build());
        em.flush();
        assertThat(repository.searchRecordedReferences(payment.getAgence().getId(), "%shared%", null, null,
                null, null, "CLIENT", client.getId(), PageRequest.of(0, 25)).getContent()).containsExactly(allocated);
    }

    private ReglementClient payment(String key) {
        Agence agency = em.persist(Agence.builder().code(key).nom(key).build());
        Role role = em.persist(Role.builder().agence(agency).code("TEST").nom("Test").build());
        Utilisateur user = em.persist(Utilisateur.builder().agence(agency).role(role).email(key + "@test.invalid")
                .password("unused").prenom("Test").nom("User").build());
        return em.persist(ReglementClient.builder().agence(agency).creePar(user).numero("REG-" + key)
                .payeurNom("Payeur").dateReglement(LocalDate.of(2026, 10, 13))
                .montantTotal(new BigDecimal("100.00")).montantNonAffecte(BigDecimal.ZERO).build());
    }

    private InstrumentReglementClient instrument(ReglementClient payment, String reference,
            ModeReglementClient mode, StatutInstrumentReglement status) {
        return em.persist(InstrumentReglementClient.builder().agence(payment.getAgence()).reglement(payment)
                .referenceInstrument(reference).mode(mode).statut(status).montant(BigDecimal.TEN)
                .dateInstrument(payment.getDateReglement()).dateStatut(payment.getDateReglement()).build());
    }
}
