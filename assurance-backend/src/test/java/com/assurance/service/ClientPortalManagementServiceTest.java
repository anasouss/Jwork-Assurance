package com.assurance.service;

import com.assurance.dto.request.ClientPortalRequests;
import com.assurance.entity.*;
import com.assurance.enums.TypeClient;
import com.assurance.repository.*;
import com.assurance.security.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClientPortalManagementServiceTest {
    @Mock ClientPortalAccountRepository accounts;
    @Mock ClientPortalSessionRepository sessions;
    @Mock ClientPortalAccessRepository accesses;
    @Mock ClientPortalDocumentRepository documents;
    @Mock ClientPortalClaimUpdateRepository updates;
    @Mock ClientRepository clients;
    @Mock ContratRepository contracts;
    @Mock SinistreRepository claims;
    @Mock PieceJointeRepository pieces;
    @Mock SinistreDocumentRepository claimDocuments;
    @Mock PasswordEncoder encoder;
    @Mock AuditEventRepository audits;
    @Mock ClientPortalFeatureService feature;
    @Mock ClientPortalContractCandidateRepository contractCandidates;
    @Mock ClientPortalClaimCandidateRepository claimCandidates;
    @Spy ObjectMapper mapper = new ObjectMapper();
    @InjectMocks ClientPortalManagementService service;

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    void disabledFeatureBlocksManagementBeforeAnyDataLookup() {
        actor("client-portal-account:view");
        doThrow(new org.springframework.security.access.AccessDeniedException("Disabled"))
                .when(feature).requireEnabled(1L);
        assertThatThrownBy(() -> service.accounts(0, 25))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(accounts);
    }

    @Test
    void companyAccountDefaultsToRcAndDoesNotAutomaticallyShareAnything() {
        actor("client-portal-account:create");
        var agency = Agence.builder().code("AG-1").nom("Agence").build();
        agency.setId(1L);
        var client = Client.builder().agence(agency).typeClient(TypeClient.PERSONNE_MORALE)
                .raisonSociale("Entreprise").rc("12345/Agadir").build();
        client.setId(4L);
        when(clients.findByAgenceIdAndId(1L, 4L)).thenReturn(Optional.of(client));
        when(encoder.encode("initial-password-123")).thenReturn("encoded");
        when(accounts.saveAndFlush(any())).thenAnswer(invocation -> {
            ClientPortalAccount account = invocation.getArgument(0);
            account.setId(9L);
            return account;
        });
        var response = service.create(new ClientPortalRequests.CreateAccount(4L, null, "initial-password-123"));
        assertThat(response.identifiant()).isEqualTo("12345/AGADIR");
        assertThat(response.passwordChangeRequired()).isTrue();
        verifyNoInteractions(accesses, documents, updates);
        var event = ArgumentCaptor.forClass(AuditEvent.class);
        verify(audits).save(event.capture());
        assertThat(event.getValue().getAfterData()).doesNotContain("password", "encoded", "initial-password");
    }

    @Test
    void disablingAndPasswordResetBothRevokeSessions() {
        actor("client-portal-account:deactivate", "client-portal-account:reset-password");
        var account = new ClientPortalAccount();
        when(accounts.findForUpdate(9L, 1L)).thenReturn(Optional.of(account));
        service.setActive(9L, false);
        assertThat(account.isActif()).isFalse();
        when(encoder.encode("replacement-password-123")).thenReturn("new-hash");
        service.resetPassword(9L, "replacement-password-123");
        assertThat(account.getPasswordHash()).isEqualTo("new-hash");
        assertThat(account.isPasswordChangeRequired()).isTrue();
        verify(sessions, times(2)).revokeAll(9L);
    }

    @Test
    void sharingCannotResolveAnotherAgencyContract() {
        actor("client-portal-account:assign", "contrat:view");
        var account = new ClientPortalAccount();
        when(accounts.findForUpdate(9L, 1L)).thenReturn(Optional.of(account));
        when(contracts.findByAgenceIdAndId(1L, 99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.grant(9L, new ClientPortalRequests.Grant(99L, null)))
                .isInstanceOf(com.assurance.exception.ResourceNotFoundException.class);
        verify(accesses, never()).saveAndFlush(any());
    }

    private void actor(String... permissions) {
        TenantContext.setCurrentAgence(1L);
        TenantContext.setCurrentUser(2L);
        TenantContext.setCurrentUsername("staff");
        String[] authorities = java.util.Arrays.stream(permissions).map(p -> "PERM_" + p).toArray(String[]::new);
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("staff", null, authorities));
    }
}
