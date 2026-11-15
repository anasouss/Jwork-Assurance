package com.assurance.repository;

import com.assurance.entity.*;
import com.assurance.enums.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.*;
import org.springframework.data.domain.PageRequest;
import static org.assertj.core.api.Assertions.*;

@DataJpaTest(showSql = false, properties = {
        "spring.datasource.url=jdbc:h2:mem:client-portal;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect"
})
class ClientPortalRepositoryTest {
    @Autowired TestEntityManager em;
    @Autowired ClientPortalAccessRepository accesses;
    @Autowired ClientPortalDocumentRepository documents;

    @Test
    void payerRelationshipAloneNeverGrantsAccessAndRevocationTakesEffect() {
        var agency = agency("PORTAL-1");
        var other = agency("PORTAL-2");
        var account = account(agency, "C-PORTAL-1");
        var contract = contract(agency);
        contract.setPayeurPrime(account.getClient());
        em.flush();
        var page = PageRequest.of(0, 25);
        assertThat(accesses.contracts(agency.getId(), account.getId(), page)).isEmpty();
        var access = access(account, contract);
        em.flush();
        assertThat(accesses.contracts(agency.getId(), account.getId(), page)).hasSize(1);
        assertThat(accesses.contracts(other.getId(), account.getId(), page)).isEmpty();
        access.setActif(false);
        em.flush();
        assertThat(accesses.visibleContract(agency.getId(), account.getId(), contract.getId())).isEmpty();
    }

    @Test
    void anotherAccountCannotReadPublishedDocumentAndContractOnlyPublicationsWork() {
        var agency = agency("PORTAL-DOC");
        var owner = account(agency, "C-PORTAL-DOC-1");
        var other = account(agency, "C-PORTAL-DOC-2");
        var contract = contract(agency);
        var access = access(owner, contract);
        var piece = em.persist(PieceJointe.builder().contrat(contract).agence(agency)
                .nomFichier("police.pdf").cheminStockage(agency.getId() + "/" + contract.getId() + "/police.pdf").build());
        var document = new ClientPortalDocument();
        document.setAccess(access);
        document.setPieceJointe(piece);
        document.setTitre("Police");
        em.persistAndFlush(document);
        assertThat(documents.visible(agency.getId(), owner.getId(), PageRequest.of(0, 25))).hasSize(1);
        var anotherContract = contract(agency);
        em.flush();
        assertThat(documents.visibleForDossier(agency.getId(), owner.getId(), contract.getId(), null,
                PageRequest.of(0, 25))).hasSize(1);
        assertThat(documents.visibleForDossier(agency.getId(), owner.getId(), anotherContract.getId(), null,
                PageRequest.of(0, 25))).isEmpty();
        assertThat(documents.visibleForDossier(agency.getId(), owner.getId(), null, Long.MAX_VALUE,
                PageRequest.of(0, 25))).isEmpty();
        assertThat(documents.visibleForDossier(agency.getId(), other.getId(), contract.getId(), null,
                PageRequest.of(0, 25))).isEmpty();
        var anotherAgency = agency("PORTAL-DOC-OTHER");
        assertThat(documents.visibleForDossier(anotherAgency.getId(), owner.getId(), contract.getId(), null,
                PageRequest.of(0, 25))).isEmpty();
        assertThat(documents.visible(agency.getId(), other.getId(), document.getId())).isEmpty();
        document.setPublished(false);
        em.flush();
        assertThat(documents.visible(agency.getId(), owner.getId(), document.getId())).isEmpty();
        assertThat(documents.visibleForDossier(agency.getId(), owner.getId(), contract.getId(), null,
                PageRequest.of(0, 25))).isEmpty();
    }

    @Test
    void draftContractsStayHiddenEvenWithAnAccessRow() {
        var agency = agency("PORTAL-DRAFT");
        var owner = account(agency, "C-PORTAL-DRAFT");
        var contract = contract(agency);
        contract.setBrouillon(true);
        access(owner, contract);
        em.flush();
        assertThat(accesses.visibleContract(agency.getId(), owner.getId(), contract.getId())).isEmpty();
    }

    private Agence agency(String code) {
        return em.persist(Agence.builder().code(code).nom(code).build());
    }

    private ClientPortalAccount account(Agence agency, String code) {
        var client = em.persist(Client.builder().agence(agency).typeClient(TypeClient.PERSONNE_PHYSIQUE)
                .codeClient(code).nom(code).build());
        var account = new ClientPortalAccount();
        account.setAgence(agency);
        account.setClient(client);
        account.setIdentifiant(code);
        account.setPasswordHash("encoded");
        return em.persist(account);
    }

    private Contrat contract(Agence agency) {
        return em.persist(Contrat.builder().agence(agency).typeContrat(TypeContrat.PARTICULIER)
                .brouillon(false).prospection(false).statut(StatutContrat.ACTIVE).numeroPolice("PORTAL-POLICE").build());
    }

    private ClientPortalAccess access(ClientPortalAccount account, Contrat contract) {
        var access = new ClientPortalAccess();
        access.setAccount(account);
        access.setContrat(contract);
        return em.persist(access);
    }
}
