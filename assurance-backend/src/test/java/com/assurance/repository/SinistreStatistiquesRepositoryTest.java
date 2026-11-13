package com.assurance.repository;

import com.assurance.entity.*;
import com.assurance.enums.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(showSql = false, properties = {
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect"
})
class SinistreStatistiquesRepositoryTest {

    @Autowired
    private SinistreStatistiquesRepository repository;
    @Autowired
    private TestEntityManager em;
    private Agence agency;
    private CompagnieAssurance company;
    private Client client;
    private Contrat contract;
    private MouvementContrat movement;
    private Utilisateur user;
    private final LocalDate start = LocalDate.of(2025, 1, 1);
    private final LocalDate end = LocalDate.of(2025, 12, 31);

    @BeforeEach
    void setUp() {
        agency = em.persist(Agence.builder().code("STATS").nom("Agence").build());
        company = em.persist(CompagnieAssurance.builder().code("STATS-C").nom("Compagnie").build());
        var branch = em.persist(BrancheAssurance.builder().code("STATS-AUTO").libelle("Automobile").build());
        var role = em.persist(Role.builder().code("STATS-ROLE").nom("Gestionnaire").build());
        user = em.persist(Utilisateur.builder().agence(agency).role(role).email("stats@example.test")
                .password("not-used").nom("Test").prenom("Gestionnaire").build());
        client = em.persist(Client.builder().agence(agency).typeClient(TypeClient.PERSONNE_PHYSIQUE).nom("Assuré").build());
        contract = em.persist(Contrat.builder().agence(agency).typeContrat(TypeContrat.PARTICULIER)
                .statut(StatutContrat.ACTIVE).brouillon(false).prospection(false)
                .brancheAssurance(branch).compagnieAssurance(company).build());
        var type = em.persist(TypeMouvementContrat.builder().code("STATS-AN").libelle("Affaire nouvelle")
                .categorie(CategorieMouvementContrat.AFFAIRE_NOUVELLE).build());
        movement = em.persist(MouvementContrat.builder().agence(agency).contrat(contract)
                .typeMouvement(type).statut(StatutMouvementContrat.VALIDE).build());
    }

    @Test
    void aggregatesAreIsolatedByAgencyYearAndDeclaredClaimLifecycle() {
        claim(agency, "ACTIVE", StatutSinistre.DECLARE, start.plusDays(5));
        var closed = claim(agency, "CLOSED", StatutSinistre.CLOTURE, start.plusMonths(1));
        closed.setDateCloture(start.plusMonths(1).plusDays(9));
        claim(agency, "DRAFT", StatutSinistre.BROUILLON, start);
        claim(agency, "CANCELLED", StatutSinistre.ANNULE, start);
        claim(agency, "OTHER-YEAR", StatutSinistre.DECLARE, start.minusDays(1));
        var other = em.persist(Agence.builder().code("STATS-OTHER").nom("Autre agence").build());
        claim(other, "OTHER-AGENCY", StatutSinistre.DECLARE, start);
        em.flush();

        assertThat(repository.etats(agency.getId(), start, end, end)).extracting(SinistreStatistiquesRepository.Etat::getNombre)
                .containsExactlyInAnyOrder(1L, 1L);
        assertThat(repository.mensuels(agency.getId(), start, end)).extracting(SinistreStatistiquesRepository.Mensuel::getMois)
                .containsExactly(1, 2);
        assertThat(repository.compagnies(agency.getId(), start, end)).singleElement()
                .satisfies(row -> assertThat(row.getNombre()).isEqualTo(2));
        assertThat(repository.branches(agency.getId(), start, end)).singleElement()
                .satisfies(row -> assertThat(row.getNombre()).isEqualTo(2));
        assertThat(repository.delais(agency.getId(), start, end)).singleElement()
                .satisfies(row -> assertThat(row.getCloture()).isEqualTo(closed.getDateCloture()));
        assertThat(repository.annees(agency.getId())).containsExactly(2025, 2024);
    }

    @Test
    void cumulativeMoneyExcludesCancelledOperationsAndUsesLatestOpenProvisionOnly() {
        var claim = claim(agency, "PAYMENT", StatutSinistre.DECLARE, start);
        operation(claim, TypeOperationSinistre.REGLEMENT, "125.50");
        var cancelled = operation(claim, TypeOperationSinistre.REGLEMENT, "500.00");
        var reversal = operation(claim, TypeOperationSinistre.ANNULATION, "500.00");
        reversal.setOperationAnnulee(cancelled);
        operation(claim, TypeOperationSinistre.RECOURS, "25.75");
        operation(claim, TypeOperationSinistre.FRAIS, "10.00");
        provision(claim, "1000.00", start);
        provision(claim, "300.00", start.plusDays(1));
        var closed = claim(agency, "CLOSED-PROVISION", StatutSinistre.CLOTURE, start);
        provision(closed, "999.00", start.plusDays(1));
        em.flush();

        assertThat(repository.finances(agency.getId(), start, end)).singleElement().satisfies(row -> {
            assertThat(row.getReglements()).isEqualByComparingTo("125.50");
            assertThat(row.getRecours()).isEqualByComparingTo("25.75");
            assertThat(row.getFrais()).isEqualByComparingTo("10.00");
        });
        assertThat(repository.provisions(agency.getId(), start, end, List.of(StatutSinistre.DECLARE)))
                .singleElement().satisfies(row -> assertThat(row.getMontant()).isEqualByComparingTo("300.00"));
        assertThat(repository.finances(-99L, start, end)).isEmpty();
        assertThat(repository.provisions(-99L, start, end, List.of(StatutSinistre.DECLARE))).isEmpty();
    }

    private Sinistre claim(Agence owner, String number, StatutSinistre status, LocalDate date) {
        return em.persist(Sinistre.builder().agence(owner).contrat(contract).mouvementCouverture(movement)
                .client(client).compagnieAssurance(company).numeroSinistre(number).statut(status)
                .etapeSuivi(status == StatutSinistre.CLOTURE ? EtapeSuiviSinistre.CLOTURE : EtapeSuiviSinistre.OUVERTURE)
                .dateSinistre(date).dateDeclaration(date).build());
    }

    private SinistreOperation operation(Sinistre claim, TypeOperationSinistre type, String amount) {
        return em.persist(SinistreOperation.builder().sinistre(claim).saisiPar(user).compagnieAssurance(company)
                .type(type).dateOperation(start.plusYears(1)).montant(new BigDecimal(amount))
                .typeContrepartie(TypeContrepartieSinistre.CLIENT).modeReglement(ModeReglementSinistre.VIREMENT).build());
    }

    private void provision(Sinistre claim, String amount, LocalDate date) {
        em.persist(ProvisionSinistre.builder().sinistre(claim).saisiePar(user).dateProvision(date)
                .montant(new BigDecimal(amount)).motif("Estimation").build());
    }
}
