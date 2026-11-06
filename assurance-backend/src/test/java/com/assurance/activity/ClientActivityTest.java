package com.assurance.activity;

import com.assurance.entity.Agence;
import com.assurance.entity.Client;
import com.assurance.entity.ClientTelephone;
import com.assurance.enums.TypeClient;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ClientActivityTest {
    @Test
    void telephoneRowReplacementOrReorderingIsNotABusinessModification() {
        Client client = client();
        client.setTelephones(List.of(phone("0661000000", true), phone("0662000000", false)));
        var before = ClientActivity.snapshot(client);
        client.setTelephones(List.of(phone("0662000000", false), phone("0661000000", true)));
        assertThat(ActivityValues.changes(before, ClientActivity.snapshot(client))).isEmpty();
    }

    @Test
    void actualClientChangesUseReadableLabelsAndClientCode() {
        Client client = client();
        client.setAdresse("Ancienne adresse");
        var before = ClientActivity.capture(client);
        client.setAdresse("Nouvelle adresse");
        var command = ClientActivity.command(client, before, ActivityAction.UPDATED, "Client modifie", "CLIENT_UPDATE");
        assertThat(command.subject().label()).isEqualTo("C000057 - Mohamed Boukha");
        assertThat(command.changes()).containsExactly(new ActivityChange("Adresse", "Ancienne adresse", "Nouvelle adresse"));
    }

    @Test
    void equallyNamedCategoriesRemainDifferentSelectionsWithHistoricalReferences() {
        Client client = client();
        var oldCategory = com.assurance.entity.CategorieClient.builder().code("A").libelle("Grand public").build();
        oldCategory.setId(1L);
        var newCategory = com.assurance.entity.CategorieClient.builder().code("B").libelle("Grand public").build();
        newCategory.setId(2L);
        client.setCategorieClient(oldCategory);
        var before = ClientActivity.capture(client);
        client.setCategorieClient(newCategory);

        var command = ClientActivity.command(client, before, ActivityAction.UPDATED, "Client modifie", "CLIENT_UPDATE");

        assertThat(command.changes()).containsExactly(new ActivityChange("Cat\u00e9gorie", null, "Selection actualisee"));
        assertThat(command.references()).filteredOn(reference -> reference.type() == ActivityRecordType.CATEGORIE_CLIENT)
                .extracting(ActivityReference::id).containsExactly("1", "2");
    }

    private Client client() {
        Agence agency = new Agence();
        agency.setId(1L);
        Client client = Client.builder().agence(agency).typeClient(TypeClient.PERSONNE_PHYSIQUE)
                .prenom("Mohamed").nom("Boukha").codeClient("C000057").build();
        client.setId(57L);
        return client;
    }

    private ClientTelephone phone(String number, boolean principal) {
        return ClientTelephone.builder().numero(number).principal(principal).whatsapp(false).build();
    }
}
