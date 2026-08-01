package com.assurance.service;

import com.assurance.entity.RefreshSession;
import com.assurance.entity.Utilisateur;
import com.assurance.repository.RefreshSessionRepository;
import com.assurance.security.JwtTokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private AuthenticationManager authenticationManager;
    @Mock
    private com.assurance.repository.UtilisateurRepository userRepository;
    @Mock
    private RefreshSessionRepository refreshSessionRepository;
    @Mock
    private JwtTokenProvider tokenProvider;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private HttpServletRequest request;

    private AuthService service;

    @BeforeEach
    void setUp() {
        service = new AuthService(
                authenticationManager,
                userRepository,
                refreshSessionRepository,
                tokenProvider,
                passwordEncoder
        );
        ReflectionTestUtils.setField(service, "refreshTokenExpiration", 1_296_000_000L);
    }

    @Test
    void rotatesRefreshTokenUnderLockAndStoresOnlyItsHash() {
        String currentToken = "current-browser-secret";
        String nextToken = "next-browser-secret";
        Utilisateur user = user();
        RefreshSession currentSession = RefreshSession.builder()
                .id(4L)
                .user(user)
                .token(hash(currentToken))
                .expiresAt(LocalDateTime.now().plusDays(1))
                .revoked(false)
                .build();

        when(refreshSessionRepository.findByTokenForUpdate(hash(currentToken)))
                .thenReturn(Optional.of(currentSession));
        when(tokenProvider.generateRefreshToken()).thenReturn(nextToken);
        when(tokenProvider.generateAccessToken(user)).thenReturn("access-token");
        when(tokenProvider.getAccessTokenExpirationInSeconds()).thenReturn(900L);
        when(refreshSessionRepository.save(any(RefreshSession.class))).thenAnswer(invocation -> {
            RefreshSession session = invocation.getArgument(0);
            if (session.getId() == null) session.setId(5L);
            return session;
        });

        AuthService.AuthSessionResult result = service.refreshToken(currentToken, request);

        assertThat(result.refreshToken()).isEqualTo(nextToken);
        assertThat(result.response().getAccessToken()).isEqualTo("access-token");
        assertThat(currentSession.getRevoked()).isTrue();

        ArgumentCaptor<RefreshSession> saved = ArgumentCaptor.forClass(RefreshSession.class);
        verify(refreshSessionRepository, org.mockito.Mockito.times(2)).save(saved.capture());
        RefreshSession replacement = saved.getAllValues().get(1);
        assertThat(replacement.getToken()).isEqualTo(hash(nextToken));
        assertThat(replacement.getToken()).doesNotContain(nextToken);
    }

    @Test
    void hashesTheCookieValueBeforeLogoutLookup() {
        String token = "logout-browser-secret";
        RefreshSession session = RefreshSession.builder()
                .expiresAt(LocalDateTime.now().plusDays(1))
                .revoked(false)
                .build();
        when(refreshSessionRepository.findByToken(hash(token))).thenReturn(Optional.of(session));

        service.logout(token);

        verify(refreshSessionRepository).findByToken(hash(token));
        assertThat(session.getRevoked()).isTrue();
    }

    private Utilisateur user() {
        Utilisateur user = org.mockito.Mockito.mock(Utilisateur.class);
        when(user.getEmail()).thenReturn("agent@example.test");
        when(user.getFullName()).thenReturn("Agent Test");
        when(user.getRoleCode()).thenReturn("AGENT");
        when(user.getPermissions()).thenReturn(Set.of("contrat:view"));
        return user;
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256")
                            .digest(value.getBytes(StandardCharsets.UTF_8))
            );
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
