package com.assurance.service;

import com.assurance.entity.*;
import com.assurance.enums.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(showSql = false, properties = {
        "spring.datasource.url=jdbc:h2:mem:convention-production-settlement;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect"
})
class ConventionProductionSettlementTest {
    @Autowired private TestEntityManager em;

    @Test
    void onlyConfirmedValidFullPaymentsCountAsCollected() {
        Agence agency = agency("SETTLEMENT");
        ElementFacturable full = element(agency);
        ElementFacturable partial = element(agency);
        ElementFacturable pending = element(agency);
        ElementFacturable cancelled = element(agency);
        allocate(agency, full, null, "100", StatutAffectationReglement.CONFIRMEE, StatutReglementClient.VALIDE);
        allocate(agency, partial, null, "40", StatutAffectationReglement.CONFIRMEE, StatutReglementClient.VALIDE);
        allocate(agency, pending, null, "100", StatutAffectationReglement.EN_ATTENTE, StatutReglementClient.VALIDE);
        allocate(agency, cancelled, null, "100", StatutAffectationReglement.CONFIRMEE, StatutReglementClient.ANNULE);
        assertThat(collected(agency)).containsExactly(full.getId());
    }

    @Test
    void payingOnePeriodDoesNotCollectTheEntireSource() {
        Agence agency = agency("PERIODS");
        ElementFacturable source = element(agency);
        DocumentClient first = invoice(agency, source, "50", "100", "PERIOD-1");
        allocate(agency, null, first, "50", StatutAffectationReglement.CONFIRMEE, StatutReglementClient.VALIDE);
        assertThat(collected(agency)).isEmpty();
        DocumentClient second = invoice(agency, source, "50", "100", "PERIOD-2");
        allocate(agency, null, second, "50", StatutAffectationReglement.CONFIRMEE, StatutReglementClient.VALIDE);
        assertThat(collected(agency)).containsExactly(source.getId());
        second.setStatut(StatutDocumentClient.ANNULE);
        assertThat(collected(agency)).isEmpty();
    }

    @Test
    void usesClientBulletinRatherThanInsurancePremium() {
        Agence agency = agency("BULLETIN");
        ElementFacturable source = element(agency);
        DocumentClient invoice = invoice(agency, source, "150", "150", "CLIENT-AMOUNT");
        allocate(agency, null, invoice, "100", StatutAffectationReglement.CONFIRMEE, StatutReglementClient.VALIDE);
        assertThat(collected(agency)).isEmpty();
        allocate(agency, null, invoice, "50", StatutAffectationReglement.CONFIRMEE, StatutReglementClient.VALIDE);
        assertThat(collected(agency)).containsExactly(source.getId());
    }

    @Test
    void ignoresPaymentsFromAnotherAgency() {
        Agence agency = agency("OWN");
        Agence other = agency("OTHER");
        ElementFacturable source = element(agency);
        allocate(other, source, null, "100", StatutAffectationReglement.CONFIRMEE, StatutReglementClient.VALIDE);
        assertThat(collected(agency)).isEmpty();
    }

    private List<Long> collected(Agence agency) {
        em.flush();
        var cb = em.getEntityManager().getCriteriaBuilder();
        var query = cb.createQuery(Long.class);
        var source = query.from(ElementFacturable.class);
        query.select(source.get("id")).where(cb.equal(source.get("agence").get("id"), agency.getId()),
                ConventionProductionSettlement.collected(source, query, cb, agency.getId()));
        return em.getEntityManager().createQuery(query).getResultList();
    }

    private Agence agency(String code) {
        return em.persist(Agence.builder().code(code).nom(code).build());
    }

    private ElementFacturable element(Agence agency) {
        var contract = em.persist(Contrat.builder().agence(agency).typeContrat(TypeContrat.CONVENTION)
                .dateEffet(LocalDate.of(2026, 1, 1)).dateEcheance(LocalDate.of(2026, 12, 31)).build());
        return em.persist(ElementFacturable.builder().agence(agency).contrat(contract)
                .nature(NatureElementFacturable.CONTRAT).primeTotale(new BigDecimal("100")).build());
    }

    private DocumentClient invoice(Agence agency, ElementFacturable source, String amount, String bulletin, String number) {
        BigDecimal total = new BigDecimal(amount);
        var invoice = em.persist(DocumentClient.builder().agence(agency).typeDocument(TypeDocumentClient.FACTURE)
                .numero(number).payeurNom("Convention").dateEmission(LocalDate.now())
                .periodeDebut(LocalDate.of(2026, 1, 1)).periodeFin(LocalDate.of(2026, 12, 31))
                .totalDebit(total).totalCredit(BigDecimal.ZERO).totalDocument(total).build());
        em.persist(LigneDocumentClient.builder().document(invoice).elementFacturable(source).ordre(1)
                .dateOperation(LocalDate.now()).montantTtc(total).montantBulletinConvention(new BigDecimal(bulletin))
                .debit(total).credit(BigDecimal.ZERO).primeNette(total).taxes(BigDecimal.ZERO).accessoires(BigDecimal.ZERO).build());
        return invoice;
    }

    private void allocate(Agence agency, ElementFacturable source, DocumentClient invoice, String amount,
            StatutAffectationReglement status, StatutReglementClient paymentStatus) {
        String suffix = java.util.UUID.randomUUID().toString();
        var role = em.persist(Role.builder().agence(agency).code(suffix).nom("Test").build());
        var user = em.persist(Utilisateur.builder().agence(agency).role(role).email(suffix + "@test.invalid")
                .password("unused").prenom("Test").nom("Test").build());
        var payment = em.persist(ReglementClient.builder().agence(agency).numero(suffix).payeurNom("Convention")
                .dateReglement(LocalDate.now()).montantTotal(new BigDecimal(amount)).montantNonAffecte(BigDecimal.ZERO)
                .statut(paymentStatus).creePar(user).build());
        var instrument = em.persist(InstrumentReglementClient.builder().agence(agency).reglement(payment)
                .mode(ModeReglementClient.VIREMENT).statut(StatutInstrumentReglement.CONFIRME)
                .montant(new BigDecimal(amount)).dateStatut(LocalDate.now()).build());
        em.persist(AffectationReglementClient.builder().instrument(instrument).elementFacturable(source)
                .documentClient(invoice).montant(new BigDecimal(amount)).statut(status).payeurNomSnapshot("Convention").build());
    }
}
