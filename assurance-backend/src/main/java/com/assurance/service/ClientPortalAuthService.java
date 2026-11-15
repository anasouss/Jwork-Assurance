package com.assurance.service;

import com.assurance.dto.request.ClientPortalRequests;
import com.assurance.dto.response.ClientPortalResponses;
import com.assurance.entity.ClientPortalAccount;
import com.assurance.entity.ClientPortalSession;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.UnauthorizedException;
import com.assurance.repository.ClientPortalAccountRepository;
import com.assurance.repository.ClientPortalSessionRepository;
import com.assurance.security.ClientPortalCredentials;
import com.assurance.security.ClientPortalAccountPolicy;
import com.assurance.security.ClientPortalPrincipal;
import com.assurance.security.JwtTokenProvider;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;

@Service
@RequiredArgsConstructor
public class ClientPortalAuthService {
    private final ClientPortalAccountRepository accounts;
    private final ClientPortalSessionRepository sessions;
    private final PasswordEncoder encoder;
    private final JwtTokenProvider tokens;
    private final ClientPortalFeatureService feature;

    @Value("${jwt.refresh-token-expiration-mobile}")
    private long refreshExpiration;

    private String dummyHash;

    @PostConstruct
    void initialize() {
        dummyHash = encoder.encode(UUID.randomUUID().toString());
    }

    @Transactional(noRollbackFor = UnauthorizedException.class)
    public ClientPortalResponses.Tokens login(ClientPortalRequests.Login request) {
        String login;
        try {
            login = ClientPortalCredentials.normalizeIdentifier(request.identifiant());
        } catch (BadRequestException invalid) {
            encoder.matches(request.password(), dummyHash);
            throw invalidCredentials();
        }
        ClientPortalAccount account = accounts.findForLogin(request.agenceCode().strip(), login).orElse(null);
        return authenticate(account, request.password());
    }

    @Transactional(noRollbackFor = UnauthorizedException.class)
    public ClientPortalResponses.Tokens loginMobile(String identifier, String password) {
        String login;
        try {
            login = ClientPortalCredentials.normalizeIdentifier(identifier);
        } catch (BadRequestException invalid) {
            encoder.matches(password, dummyHash);
            throw invalidCredentials();
        }
        var candidates = accounts.findForGlobalLogin(login, PageRequest.of(0, 2));
        // Fail closed if legacy duplicates exist before the uniqueness migration is applied.
        return authenticate(candidates.size() == 1 ? candidates.get(0) : null, password);
    }

    private ClientPortalResponses.Tokens authenticate(ClientPortalAccount account, String password) {
        boolean passwordValid = password.getBytes(StandardCharsets.UTF_8).length <= 72
                && encoder.matches(password, account == null ? dummyHash : account.getPasswordHash());
        LocalDateTime now = LocalDateTime.now();
        if (account == null || !available(account)
                || (account.getLockedUntil() != null && account.getLockedUntil().isAfter(now))) {
            throw invalidCredentials();
        }
        if (!passwordValid) {
            account.setFailedAttempts(account.getFailedAttempts() + 1);
            if (account.getFailedAttempts() >= 10) {
                account.setLockedUntil(now.plusMinutes(15));
                account.setFailedAttempts(0);
            }
            accounts.save(account);
            throw invalidCredentials();
        }
        account.setFailedAttempts(0);
        account.setLockedUntil(null);
        account.setLastLoginAt(now);
        return createSession(account);
    }

    @Transactional(noRollbackFor = UnauthorizedException.class)
    public ClientPortalResponses.Tokens refresh(String token) {
        String hash = ClientPortalCredentials.hash(token);
        var owner = sessions.findRefreshOwner(hash).orElseThrow(this::invalidCredentials);
        // Account-first locking matches password reset/disable and avoids lock-order inversion.
        ClientPortalAccount account = accounts.findForUpdate(owner.getAccountId(), owner.getAgenceId())
                .orElseThrow(this::invalidCredentials);
        ClientPortalSession session = sessions.findForRefresh(hash).orElseThrow(this::invalidCredentials);
        if (session.isRevoked()) {
            sessions.revokeAll(account.getId());
            throw invalidCredentials();
        }
        if (!available(account) || !session.getExpiresAt().isAfter(LocalDateTime.now())) {
            throw invalidCredentials();
        }
        session.setRevoked(true);
        sessions.save(session);
        return createSession(account);
    }

    @Transactional
    public void logout(String token) {
        sessions.findForRefresh(ClientPortalCredentials.hash(token)).ifPresent(session -> {
            session.setRevoked(true);
            sessions.save(session);
        });
    }

    @Transactional(readOnly = true)
    public ClientPortalResponses.Profile profile() {
        return profile(currentAccount(false));
    }

    @Transactional
    public void changePassword(ClientPortalRequests.ChangePassword request) {
        ClientPortalPrincipal principal = ClientPortalPrincipal.current();
        ClientPortalAccount account = accounts.findForUpdate(principal.accountId(), principal.agenceId())
                .filter(this::available).orElseThrow(this::invalidCredentials);
        ClientPortalCredentials.validatePassword(request.newPassword());
        if (!encoder.matches(request.currentPassword(), account.getPasswordHash())) {
            throw new BadRequestException("Mot de passe actuel incorrect");
        }
        if (encoder.matches(request.newPassword(), account.getPasswordHash())) {
            throw new BadRequestException("Choisissez un nouveau mot de passe différent");
        }
        account.setPasswordHash(encoder.encode(request.newPassword()));
        account.setPasswordChangeRequired(false);
        accounts.save(account);
        sessions.revokeAll(account.getId());
    }

    @Transactional(readOnly = true)
    public ClientPortalAccount currentAccount(boolean requirePasswordChangeCompleted) {
        ClientPortalPrincipal principal = ClientPortalPrincipal.current();
        ClientPortalAccount account = accounts.findByIdAndAgenceId(principal.accountId(), principal.agenceId())
                .filter(this::available).orElseThrow(this::invalidCredentials);
        if (!account.getClient().getId().equals(principal.clientId())) {
            throw invalidCredentials();
        }
        if (requirePasswordChangeCompleted && account.isPasswordChangeRequired()) {
            throw new org.springframework.security.access.AccessDeniedException("Changez votre mot de passe avant de consulter vos dossiers");
        }
        return account;
    }

    public boolean available(ClientPortalAccount account) {
        Long agenceId = account == null || account.getAgence() == null ? null : account.getAgence().getId();
        return ClientPortalAccountPolicy.isAvailable(account, feature.isEnabled(agenceId));
    }

    private ClientPortalResponses.Tokens createSession(ClientPortalAccount account) {
        String refresh = tokens.generateRefreshToken();
        ClientPortalSession session = new ClientPortalSession();
        session.setAccount(account);
        session.setTokenHash(ClientPortalCredentials.hash(refresh));
        session.setExpiresAt(LocalDateTime.now().plusSeconds(refreshExpiration / 1000));
        session = sessions.save(session);
        return new ClientPortalResponses.Tokens(
                tokens.generateClientPortalToken(account.getId(), account.getAgence().getId(), session.getId()),
                refresh, "Bearer", tokens.getAccessTokenExpirationInSeconds(), profile(account));
    }

    private ClientPortalResponses.Profile profile(ClientPortalAccount account) {
        return new ClientPortalResponses.Profile(account.getId(), account.getClient().getNomAffichage(),
                account.getAgence().getCode(), account.getAgence().getNom(), account.getAgence().getTelephone(),
                account.isPasswordChangeRequired());
    }

    private UnauthorizedException invalidCredentials() {
        return new UnauthorizedException("Identifiants ou session invalides");
    }
}
