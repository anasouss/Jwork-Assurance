package com.assurance.service;

import com.assurance.dto.request.ClientPortalRequests;
import com.assurance.entity.*;
import com.assurance.enums.*;
import com.assurance.exception.UnauthorizedException;
import com.assurance.repository.*;
import com.assurance.security.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClientPortalAuthServiceTest {
    @Mock ClientPortalAccountRepository accounts;
    @Mock ClientPortalSessionRepository sessions;
    @Mock PasswordEncoder encoder;
    @Mock JwtTokenProvider tokens;
    @Mock ClientPortalFeatureService feature;
    @InjectMocks ClientPortalAuthService service;

    @BeforeEach
    void setup() {
        ReflectionTestUtils.setField(service, "dummyHash", "dummy-password-hash");
        ReflectionTestUtils.setField(service, "refreshExpiration", 7_776_000_000L);
        lenient().when(feature.isEnabled(1L)).thenReturn(true);
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    void failedLoginUsesGenericErrorAndDoesNotCreateSession() {
        when(accounts.findForLogin("AG-1", "AB123")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.login(new ClientPortalRequests.Login("AG-1", "ab123", "wrong")))
                .isInstanceOf(UnauthorizedException.class).hasMessage("Identifiants ou session invalides");
        verify(encoder).matches("wrong", "dummy-password-hash");
        verifyNoInteractions(sessions);
    }

    @Test
    void tenBadPasswordsLockAnAccount() {
        var account = account();
        account.setFailedAttempts(9);
        when(accounts.findForLogin("AG-1", "AB123")).thenReturn(Optional.of(account));
        when(encoder.matches("wrong", "encoded")).thenReturn(false);
        assertThatThrownBy(() -> service.login(new ClientPortalRequests.Login("AG-1", "AB123", "wrong")))
                .isInstanceOf(UnauthorizedException.class);
        assertThat(account.getLockedUntil()).isAfter(LocalDateTime.now());
        verify(accounts).save(account);
        verifyNoInteractions(sessions);
    }

    @Test
    void loginReturnsClientTokenAndStoresOnlyHashedRefreshSecret() {
        var account = account();
        when(accounts.findForLogin("AG-1", "AB123")).thenReturn(Optional.of(account));
        when(encoder.matches("long-password-123", "encoded")).thenReturn(true);
        when(tokens.generateRefreshToken()).thenReturn("refresh-secret");
        when(sessions.save(any())).thenAnswer(invocation -> {
            ClientPortalSession session = invocation.getArgument(0);
            session.setId(5L);
            return session;
        });
        when(tokens.generateClientPortalToken(9L, 1L, 5L)).thenReturn("client-jwt");
        var response = service.login(new ClientPortalRequests.Login("AG-1", "AB123", "long-password-123"));
        assertThat(response.accessToken()).isEqualTo("client-jwt");
        assertThat(response.refreshToken()).isEqualTo("refresh-secret");
        assertThat(response.profile().passwordChangeRequired()).isTrue();
        var captured = ArgumentCaptor.forClass(ClientPortalSession.class);
        verify(sessions).save(captured.capture());
        assertThat(captured.getValue().getTokenHash()).isEqualTo(ClientPortalCredentials.hash("refresh-secret"));
    }

    @Test
    void refreshReplayRevokesAllAccountSessions() {
        var account = account();
        var session = new ClientPortalSession();
        session.setAccount(account);
        session.setRevoked(true);
        var owner = mock(ClientPortalSessionRepository.RefreshOwner.class);
        when(owner.getAccountId()).thenReturn(9L);
        when(owner.getAgenceId()).thenReturn(1L);
        when(sessions.findRefreshOwner(ClientPortalCredentials.hash("old"))).thenReturn(Optional.of(owner));
        when(sessions.findForRefresh(ClientPortalCredentials.hash("old"))).thenReturn(Optional.of(session));
        when(accounts.findForUpdate(9L, 1L)).thenReturn(Optional.of(account));
        assertThatThrownBy(() -> service.refresh("old")).isInstanceOf(UnauthorizedException.class);
        verify(sessions).revokeAll(9L);
    }

    @Test
    void featureSwitchBlocksExistingAccounts() {
        when(feature.isEnabled(1L)).thenReturn(false);
        assertThat(service.available(account())).isFalse();
    }

    @Test
    void disabledAgencyClientOrAccountCannotAuthenticate() {
        var account = account();
        assertThat(service.available(account)).isTrue();
        account.setActif(false);
        assertThat(service.available(account)).isFalse();
        account.setActif(true);
        account.getClient().setActif(false);
        assertThat(service.available(account)).isFalse();
        account.getClient().setActif(true);
        account.getAgence().setStatut(StatutAgence.SUSPENDED);
        assertThat(service.available(account)).isFalse();
    }

    @Test
    void forcedPasswordChangeBlocksDossierAccess() {
        var account = account();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new ClientPortalPrincipal(9L, 1L, 4L), null, List.of()));
        when(accounts.findByIdAndAgenceId(9L, 1L)).thenReturn(Optional.of(account));
        assertThatThrownBy(() -> service.currentAccount(true))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    private ClientPortalAccount account() {
        var agency = Agence.builder().code("AG-1").nom("Agence").statut(StatutAgence.ACTIVE).build();
        agency.setId(1L);
        var client = Client.builder().agence(agency).typeClient(TypeClient.PERSONNE_PHYSIQUE).nom("Client").build();
        client.setId(4L);
        var account = new ClientPortalAccount();
        account.setId(9L);
        account.setAgence(agency);
        account.setClient(client);
        account.setIdentifiant("AB123");
        account.setPasswordHash("encoded");
        return account;
    }
}
