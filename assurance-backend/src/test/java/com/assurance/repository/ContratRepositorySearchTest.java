package com.assurance.repository;

import com.assurance.entity.Agence;
import com.assurance.entity.Contrat;
import com.assurance.enums.TypeContrat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:contract-search;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect"
})
class ContratRepositorySearchTest {

    @Autowired
    private ContratRepository repository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void includesIncompleteDraftWithoutCompanyWhenNoCompanyFilterIsApplied() {
        Agence agence = entityManager.persist(Agence.builder()
                .code("DRAFT-SEARCH")
                .nom("Draft search")
                .build());
        Contrat draft = entityManager.persist(Contrat.builder()
                .agence(agence)
                .typeContrat(TypeContrat.PARTICULIER)
                .prospection(false)
                .brouillon(true)
                .build());
        entityManager.flush();

        var contracts = repository.searchCurrentContractIds(
                agence.getId(),
                null,
                "EFFET",
                null,
                null,
                null,
                null,
                null,
                null,
                PageRequest.of(0, 25)
        );

        assertThat(contracts.getContent()).containsExactly(draft.getId());
    }

    @Test
    void includesIncompleteProspectionWithoutCompanyWhenNoCompanyFilterIsApplied() {
        Agence agence = entityManager.persist(Agence.builder()
                .code("PROSPECTION-SEARCH")
                .nom("Prospection search")
                .build());
        Contrat prospection = entityManager.persist(Contrat.builder()
                .agence(agence)
                .typeContrat(TypeContrat.FLOTTE)
                .prospection(true)
                .brouillon(true)
                .build());
        entityManager.flush();

        var prospections = repository.searchProspectionIds(
                agence.getId(),
                null,
                null,
                null,
                null,
                null,
                PageRequest.of(0, 25)
        );

        assertThat(prospections.getContent()).containsExactly(prospection.getId());
    }

    @Test
    void contractAndProspectionSearchQueriesAreValid() {
        var contracts = repository.searchCurrentContractIds(
                -1L,
                TypeContrat.CONVENTION,
                "EFFET",
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 12, 31),
                "client",
                -1L,
                "police",
                -1L,
                PageRequest.of(0, 25)
        );
        var prospections = repository.searchProspectionIds(
                -1L,
                -1L,
                LocalDate.of(2026, 1, 1).atStartOfDay(),
                LocalDate.of(2027, 1, 1).atStartOfDay(),
                "client",
                "devis",
                PageRequest.of(0, 25)
        );

        assertThat(contracts).isEmpty();
        assertThat(prospections).isEmpty();
    }
}
