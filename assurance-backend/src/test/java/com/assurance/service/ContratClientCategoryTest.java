package com.assurance.service;

import com.assurance.dto.request.CreateClientRequest;
import com.assurance.dto.request.CreateContratRequest;
import com.assurance.entity.CategorieClient;
import com.assurance.entity.Client;
import com.assurance.entity.Contrat;
import com.assurance.enums.RoleClientContrat;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.CategorieClientRepository;
import com.assurance.repository.ClientRepository;
import com.assurance.repository.ContratClientRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContratClientCategoryTest {
    @Mock private ClientRepository clientRepository;
    @Mock private CategorieClientRepository categorieClientRepository;
    @Mock private ContratClientRepository contratClientRepository;
    @Mock private ClientService clientService;
    @InjectMocks private ContratService service;

    @Test
    void ownerAliasCannotClearOrReplaceTheSubscribersCategory() {
        CategorieClient category = category(3L);
        Client client = Client.builder().categorieClient(category).build();
        client.setId(12L);
        when(clientRepository.findByAgenceIdAndId(1L, 12L)).thenReturn(Optional.of(client));
        when(contratClientRepository.save(any())).thenAnswer(call -> call.getArgument(0));
        when(clientService.updateEntity(eq(1L), eq(12L), any())).thenAnswer(call -> {
            CreateClientRequest request = call.getArgument(2);
            assertThat(request.getCategorieClientId()).isEqualTo(3L);
            return client;
        });

        for (Long staleCategory : new Long[]{null, 9L}) {
            var subscriber = input(RoleClientContrat.SOUSCRIPTEUR, 12L, null);
            var owner = input(RoleClientContrat.PROPRIETAIRE, null, staleCategory);
            owner.setSameAsRole(RoleClientContrat.SOUSCRIPTEUR);
            Contrat contract = Contrat.builder().build();

            ReflectionTestUtils.invokeMethod(service, "saveClientLinks", contract,
                    List.of(owner, subscriber), 1L, Map.of(), false);

            assertThat(contract.getClients()).hasSize(2)
                    .allSatisfy(link -> assertThat(link.getClient()).isSameAs(client));
            assertThat(client.getCategorieClient()).isSameAs(category);
            assertThat(owner.getClient().getCategorieClientId()).isEqualTo(staleCategory);
        }
    }

    @Test
    void draftAppliesSubmittedCategoryToAnExistingAgencyClient() {
        Client client = new Client();
        CategorieClient category = category(3L);
        when(clientRepository.findByAgenceIdAndId(1L, 12L)).thenReturn(Optional.of(client));
        when(categorieClientRepository.findByIdWithUsages(3L)).thenReturn(Optional.of(category));

        Client resolved = ReflectionTestUtils.invokeMethod(service, "resolveClientForDraft", 1L,
                input(RoleClientContrat.SOUSCRIPTEUR, 12L, 3L), Map.of(), false);

        assertThat(resolved).isSameAs(client);
        assertThat(client.getCategorieClient()).isSameAs(category);
    }

    @Test
    void previewUsesSubmittedCategoryWithoutMutatingThePersistedClient() {
        CategorieClient original = category(2L);
        CategorieClient selected = category(3L);
        Client client = Client.builder().nom("ABDOU").categorieClient(original).build();
        when(clientRepository.findByAgenceIdAndId(1L, 12L)).thenReturn(Optional.of(client));
        when(categorieClientRepository.findByIdWithUsages(3L)).thenReturn(Optional.of(selected));

        Client preview = ReflectionTestUtils.invokeMethod(service, "resolveClientForPreview", 1L,
                input(RoleClientContrat.SOUSCRIPTEUR, 12L, 3L));

        assertThat(preview).isNotSameAs(client);
        assertThat(preview.getNom()).isEqualTo("ABDOU");
        assertThat(preview.getCategorieClient()).isSameAs(selected);
        assertThat(client.getCategorieClient()).isSameAs(original);
    }

    @Test
    void missingSubmittedCategoryDoesNotClearAnExistingCategory() {
        CategorieClient category = category(3L);
        Client client = Client.builder().categorieClient(category).build();
        when(clientRepository.findByAgenceIdAndId(1L, 12L)).thenReturn(Optional.of(client));

        ReflectionTestUtils.invokeMethod(service, "resolveClientForDraft", 1L,
                input(RoleClientContrat.SOUSCRIPTEUR, 12L, null), Map.of(), false);

        assertThat(client.getCategorieClient()).isSameAs(category);
        verifyNoInteractions(categorieClientRepository, clientService);
    }

    @Test
    void categoryCannotBeAppliedToAClientOutsideTheAgency() {
        when(clientRepository.findByAgenceIdAndId(1L, 12L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(service, "resolveClientForDraft", 1L,
                input(RoleClientContrat.SOUSCRIPTEUR, 12L, 3L), Map.of(), false))
                .isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(categorieClientRepository, clientService);
    }

    private static CategorieClient category(Long id) {
        CategorieClient category = new CategorieClient();
        category.setId(id);
        return category;
    }

    private static CreateContratRequest.ClientInput input(RoleClientContrat role, Long clientId, Long categoryId) {
        var input = new CreateContratRequest.ClientInput();
        input.setRole(role);
        input.setClientId(clientId);
        var client = new CreateClientRequest();
        client.setCategorieClientId(categoryId);
        input.setClient(client);
        return input;
    }
}
