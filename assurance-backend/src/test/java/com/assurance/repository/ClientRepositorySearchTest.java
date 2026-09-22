package com.assurance.repository;

import com.assurance.entity.Agence;
import com.assurance.entity.Client;
import com.assurance.enums.TypeClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:client-search;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect"
})
class ClientRepositorySearchTest {

    @Autowired
    private ClientRepository repository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void searchesDisplayedFullNameAndKeepsAgencyScope() {
        Agence agency = entityManager.persist(Agence.builder().code("CLIENT-SEARCH-1").nom("Agency one").build());
        Agence otherAgency = entityManager.persist(Agence.builder().code("CLIENT-SEARCH-2").nom("Agency two").build());
        Client client = entityManager.persist(Client.builder()
                .agence(agency)
                .typeClient(TypeClient.PERSONNE_PHYSIQUE)
                .prenom("Najia")
                .nom("Zaker")
                .codeClient("C000028")
                .build());
        entityManager.persist(Client.builder()
                .agence(otherAgency)
                .typeClient(TypeClient.PERSONNE_PHYSIQUE)
                .prenom("Najia")
                .nom("Zaker")
                .codeClient("C000029")
                .build());
        entityManager.flush();

        assertThat(search(agency.getId(), "NAJIA ZAKER")).containsExactly(client);
        assertThat(search(agency.getId(), "ZAKER NAJIA")).containsExactly(client);
        assertThat(search(agency.getId(), "NAJIA")).containsExactly(client);
        assertThat(search(otherAgency.getId(), "C000028")).isEmpty();
    }

    private java.util.List<Client> search(Long agencyId, String query) {
        return repository.searchCrm(agencyId, query, null, null, null, PageRequest.of(0, 25)).getContent();
    }
}
