package com.assurance.service;

import com.assurance.activity.ActivityRecorderFixture;
import com.assurance.dto.request.CreateClientRequest;
import com.assurance.entity.Agence;
import com.assurance.entity.Client;
import com.assurance.entity.Ville;
import com.assurance.enums.GenreClient;
import com.assurance.enums.TypeClient;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClientServiceTest {
    @Mock private AgenceRepository agencies;
    @Mock private ClientRepository clients;
    @Mock private ClientTelephoneRepository phones;
    @Mock private VilleRepository cities;
    @Mock private CategorieClientRepository categories;
    @Mock private GroupeClientService groups;
    @Mock private AcquisitionClientService acquisitions;
    @InjectMocks private ClientService service;

    @BeforeEach
    void activityRecorder() {
        ReflectionTestUtils.setField(service, "businessActivityRecorder", new ActivityRecorderFixture().recorder);
    }

    @Test
    void generatesShortClientCodeFromDatabaseId() {
        assertThat(ClientService.generateClientCode(1L)).isEqualTo("C000001");
        assertThat(ClientService.generateClientCode(1234567L)).isEqualTo("C1234567");
    }

    @Test
    void residenceCardLookupRemainsAgencyScoped() {
        when(clients.findFirstByAgenceIdAndCarteResidenceIgnoreCase(7L, "CS123")).thenReturn(Optional.empty());
        assertThat(service.searchByIdentity(7L, null, null, null, " CS123 ")).isEmpty();
        verify(clients).findFirstByAgenceIdAndCarteResidenceIgnoreCase(7L, "CS123");
        verifyNoMoreInteractions(clients);
    }

    @Test
    void crmUpdatePersistsPassportAndActualForeignResidence() {
        Client client = client();
        when(clients.findByAgenceIdAndId(7L, 42L)).thenReturn(Optional.of(client));
        when(clients.save(any(Client.class))).thenAnswer(call -> call.getArgument(0));
        when(phones.save(any())).thenAnswer(call -> call.getArgument(0));
        var request = request();
        request.setTypePieceIdentite(com.assurance.enums.TypePieceIdentite.PASSEPORT);
        request.setPassport("PA123");
        request.setPassportValidite(LocalDate.now().plusYears(2));
        request.setVilleId(null);
        request.setPaysResidence("FR");
        request.setVilleEtrangere("Lyon");

        var response = service.update(7L, 42L, request);

        assertThat(client.getPaysResidence()).isEqualTo("FR");
        assertThat(client.getVille()).isNull();
        assertThat(response.getVille()).isEqualTo("Lyon, France");
        assertThat(response.getTypePieceIdentite()).isEqualTo(com.assurance.enums.TypePieceIdentite.PASSEPORT);
        assertThat(response.getPassport()).isEqualTo("PA123");
    }

    @Test
    void crmUpdateCannotAccessAnotherAgencyClient() {
        when(clients.findByAgenceIdAndId(7L, 42L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.update(7L, 42L, request())).isInstanceOf(ResourceNotFoundException.class);
        verify(clients, never()).save(any());
    }

    @Test
    void crmUpdateRejectsTypeChangesAndIncompleteStandaloneIdentity() {
        Client client = client();
        when(clients.findByAgenceIdAndId(7L, 42L)).thenReturn(Optional.of(client));
        var changedType = request();
        changedType.setTypeClient(TypeClient.PERSONNE_MORALE);
        assertThatThrownBy(() -> service.update(7L, 42L, changedType)).isInstanceOf(BadRequestException.class);
        var incomplete = request();
        incomplete.setCin(null);
        assertThatThrownBy(() -> service.update(7L, 42L, incomplete)).isInstanceOf(BadRequestException.class);
        verify(clients, never()).save(any());
        verifyNoInteractions(phones, groups, acquisitions);
    }

    @Test
    void crmUpdateKeepsCodeAndPreservedFieldsWithoutReassigningGroups() {
        Client client = client();
        client.setClientEtranger(true);
        Ville city = Ville.builder().nom("Tiznit").build();
        city.setId(331L);
        when(clients.findByAgenceIdAndId(7L, 42L)).thenReturn(Optional.of(client));
        when(clients.findFirstByAgenceIdAndCinIgnoreCase(7L, "CIN42")).thenReturn(Optional.empty());
        when(clients.findFirstByAgenceIdAndPassportIgnoreCase(7L, "PASS42")).thenReturn(Optional.empty());
        when(cities.findById(331L)).thenReturn(Optional.of(city));
        when(clients.save(any())).thenAnswer(call -> call.getArgument(0));
        when(phones.save(any())).thenAnswer(call -> call.getArgument(0));
        var request = request();
        request.setPassport("PASS42");
        request.setNumeroPermis("PER42");
        request.setConducteurHabituel(false);
        var result = service.update(7L, 42L, request);
        assertThat(result.getCodeClient()).isEqualTo("C000042");
        assertThat(result.getClientEtranger()).isTrue();
        assertThat(result.getTelephone()).isEqualTo("0600000000");
        assertThat(result.getPassport()).isEqualTo("PASS42");
        assertThat(result.getNumeroPermis()).isEqualTo("PER42");
        assertThat(result.getConducteurHabituel()).isFalse();
        verify(groups).activePrincipalMembership(7L, 42L);
        verifyNoMoreInteractions(groups);
        verifyNoInteractions(acquisitions);
    }

    private Client client() {
        Agence agency = Agence.builder().code("TEST").nom("Test").build();
        agency.setId(7L);
        Client client = Client.builder().agence(agency).typeClient(TypeClient.PERSONNE_PHYSIQUE)
                .codeClient("C000042").nom("Client").prenom("Test").build();
        client.setId(42L);
        return client;
    }

    private CreateClientRequest request() {
        CreateClientRequest request = new CreateClientRequest();
        request.setTypeClient(TypeClient.PERSONNE_PHYSIQUE);
        request.setGenre(GenreClient.HOMME);
        request.setNom("Client");
        request.setPrenom("Test");
        request.setCin("CIN42");
        request.setCinValidite(LocalDate.of(2030, 1, 1));
        request.setVilleId(331L);
        request.setAdresse("Adresse test");
        request.setTelephone("0600000000");
        return request;
    }
}
