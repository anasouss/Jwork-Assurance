package com.assurance.service;

import com.assurance.dto.request.LoginRequest;
import com.assurance.dto.request.ChangePasswordRequest;
import com.assurance.dto.response.AuthResponse;
import com.assurance.dto.response.AgencyContextOptionResponse;
import com.assurance.dto.response.SessionResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.RefreshSession;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.StatutAgence;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.UnauthorizedException;
import com.assurance.repository.RefreshSessionRepository;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.UtilisateurRepository;
import com.assurance.security.JwtTokenProvider;
import com.assurance.security.UserPrincipal;
import com.assurance.util.DeviceInfoParser;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UtilisateurRepository userRepository;
    private final RefreshSessionRepository refreshTokenRepository;
    private final AgenceRepository agenceRepository;
    private final JwtTokenProvider tokenProvider;
    private final PasswordEncoder passwordEncoder;
    private final AuditEventService auditEventService;

    @Value("${jwt.refresh-token-expiration-web}")
    private long refreshTokenExpiration;

    @Transactional
    public AuthSessionResult login(LoginRequest request, HttpServletRequest httpRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        Utilisateur user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));
        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);
        return createSession(user, httpRequest, null);
    }

    @Transactional
    public AuthSessionResult refreshToken(String token, HttpServletRequest httpRequest) {
        if (token == null || token.isBlank()) {
            throw new UnauthorizedException("Refresh token missing");
        }
        RefreshSession refreshToken = refreshTokenRepository.findByTokenForUpdate(hashRefreshToken(token))
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));
        if (!refreshToken.isValid()) {
            throw new UnauthorizedException("Refresh token expired");
        }
        Utilisateur user = refreshToken.getUser();
        Agence effectiveAgence = validPersistedContext(user, refreshToken.getEffectiveAgence());
        refreshToken.setRevoked(true);
        refreshTokenRepository.save(refreshToken);
        return createSession(user, httpRequest, effectiveAgence);
    }

    @Transactional(readOnly = true)
    public List<AgencyContextOptionResponse> getAgencyContextOptions(Long userId) {
        requirePlatformAdmin(userId);
        return agenceRepository.findByStatutOrderByNomAsc(StatutAgence.ACTIVE).stream()
                .map(agence -> AgencyContextOptionResponse.builder()
                        .id(agence.getId())
                        .code(agence.getCode())
                        .nom(agence.getNom())
                        .ville(agence.getVille())
                        .build())
                .toList();
    }

    @Transactional
    public AuthResponse enterAgencyContext(Long userId, Long accessSessionId, String token, Long agenceId) {
        Utilisateur user = requirePlatformAdmin(userId);
        RefreshSession session = currentSessionForUpdate(userId, accessSessionId, token);
        Agence agence = agenceRepository.findById(agenceId)
                .filter(candidate -> candidate.getStatut() == StatutAgence.ACTIVE)
                .orElseThrow(() -> new BadRequestException("Agence active introuvable"));
        Agence previous = session.getEffectiveAgence();
        session.setEffectiveAgence(agence);
        session.setLastActivityAt(LocalDateTime.now());
        refreshTokenRepository.saveAndFlush(session);
        auditEventService.recordAgencyContextChange(user, session.getId(), previous, agence);
        return buildAuthResponse(user, session, agence);
    }

    @Transactional
    public AuthResponse exitAgencyContext(Long userId, Long accessSessionId, String token) {
        Utilisateur user = requirePlatformAdmin(userId);
        RefreshSession session = currentSessionForUpdate(userId, accessSessionId, token);
        Agence previous = session.getEffectiveAgence();
        session.setEffectiveAgence(null);
        session.setLastActivityAt(LocalDateTime.now());
        refreshTokenRepository.saveAndFlush(session);
        auditEventService.recordAgencyContextChange(user, session.getId(), previous, null);
        return buildAuthResponse(user, session, null);
    }

    @Transactional
    public void logout(String token) {
        if (token == null || token.isBlank()) {
            return;
        }
        refreshTokenRepository.findByToken(hashRefreshToken(token)).ifPresent(found -> {
            found.setRevoked(true);
            refreshTokenRepository.save(found);
        });
    }

    @Transactional(readOnly = true)
    public List<SessionResponse> getActiveSessions(Long userId, Long currentSessionId) {
        return refreshTokenRepository
                .findByUserIdAndRevokedFalseAndExpiresAtAfterOrderByLastActivityAtDesc(userId, LocalDateTime.now())
                .stream()
                .map(session -> SessionResponse.builder()
                        .id(session.getId())
                        .deviceName(session.getDeviceName() != null
                                ? session.getDeviceName()
                                : DeviceInfoParser.parseDeviceName(session.getUserAgent()))
                        .deviceType(session.getDeviceType() != null
                                ? session.getDeviceType()
                                : DeviceInfoParser.parseDeviceType(session.getUserAgent()))
                        .ipAddress(session.getIpAddress())
                        .current(currentSessionId != null && currentSessionId.equals(session.getId()))
                        .lastActivityAt(session.getLastActivityAt())
                        .createdAt(session.getCreatedAt())
                        .build())
                .toList();
    }

    @Transactional
    public void revokeSession(Long userId, Long sessionId) {
        RefreshSession session = refreshTokenRepository.findById(sessionId)
                .orElseThrow(() -> new BadRequestException("Session not found"));
        if (!session.getUser().getId().equals(userId)) {
            throw new UnauthorizedException("You cannot revoke this session");
        }
        session.setRevoked(true);
        refreshTokenRepository.save(session);
    }

    @Transactional
    public void revokeOtherSessions(Long userId, Long currentSessionId) {
        if (currentSessionId == null) {
            throw new UnauthorizedException("Session actuelle introuvable");
        }
        refreshTokenRepository.revokeAllByUserIdExcept(userId, currentSessionId);
    }

    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        Utilisateur user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("Utilisateur non authentifie"));
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new BadRequestException("Mot de passe actuel incorrect");
        }
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        refreshTokenRepository.revokeAllByUserId(userId);
    }

    private AuthSessionResult createSession(
            Utilisateur user,
            HttpServletRequest request,
            Agence requestedContext
    ) {
        boolean platformAdmin = isPlatformAdmin(user);
        Agence effectiveAgence = platformAdmin ? requestedContext : user.getAgence();
        if (effectiveAgence != null && effectiveAgence.getStatut() != StatutAgence.ACTIVE) {
            throw new UnauthorizedException("L'agence associée à cette session n'est pas active");
        }
        String deviceId = DeviceInfoParser.parseDeviceId(request);
        if (deviceId != null) {
            refreshTokenRepository.revokeActiveByUserIdAndDeviceId(user.getId(), deviceId);
        }
        String refreshTokenValue = tokenProvider.generateRefreshToken();
        RefreshSession refreshToken = RefreshSession.builder()
                .user(user)
                .effectiveAgence(effectiveAgence)
                .token(hashRefreshToken(refreshTokenValue))
                .expiresAt(LocalDateTime.now().plusSeconds(refreshTokenExpiration / 1000))
                .ipAddress(DeviceInfoParser.getClientIp(request))
                .userAgent(DeviceInfoParser.buildUserAgent(request))
                .deviceName(DeviceInfoParser.parseDeviceName(request))
                .deviceId(deviceId)
                .deviceType(DeviceInfoParser.parseDeviceType(request))
                .lastActivityAt(LocalDateTime.now())
                .build();
        refreshToken = refreshTokenRepository.save(refreshToken);

        AuthResponse response = buildAuthResponse(user, refreshToken, effectiveAgence);
        return new AuthSessionResult(response, refreshTokenValue);
    }

    private AuthResponse buildAuthResponse(Utilisateur user, RefreshSession session, Agence effectiveAgence) {
        String accessToken = tokenProvider.generateAccessToken(
                user,
                effectiveAgence == null ? null : effectiveAgence.getId(),
                session.getId()
        );
        boolean platformAdmin = isPlatformAdmin(user);
        return AuthResponse.builder()
                .accessToken(accessToken)
                .sessionId(session.getId())
                .tokenType("Bearer")
                .expiresIn(tokenProvider.getAccessTokenExpirationInSeconds())
                .user(AuthResponse.UtilisateurInfo.builder()
                        .id(user.getId())
                        .email(user.getEmail())
                        .fullName(user.getFullName())
                        .roleCode(user.getRoleCode())
                        .roleName(user.getRole() != null ? user.getRole().getNom() : null)
                        .agenceId(effectiveAgence != null ? effectiveAgence.getId() : null)
                        .agenceName(effectiveAgence != null ? effectiveAgence.getNom() : null)
                        .platformAdmin(platformAdmin)
                        .operatingMode(effectiveAgence == null ? "PLATFORM" : "AGENCY")
                        .permissions(user.getPermissions())
                        .build())
                .build();
    }

    private RefreshSession currentSessionForUpdate(Long userId, Long accessSessionId, String token) {
        if (token == null || token.isBlank()) {
            throw new UnauthorizedException("Refresh token missing");
        }
        RefreshSession session = refreshTokenRepository.findByTokenForUpdate(hashRefreshToken(token))
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));
        if (!session.isValid()
                || !session.getUser().getId().equals(userId)
                || accessSessionId == null
                || !session.getId().equals(accessSessionId)) {
            throw new UnauthorizedException("Invalid refresh token");
        }
        return session;
    }

    private Utilisateur requirePlatformAdmin(Long userId) {
        Utilisateur user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("Utilisateur non authentifie"));
        if (!isPlatformAdmin(user)) {
            throw new UnauthorizedException("Ce changement de contexte est réservé à l'administration plateforme");
        }
        return user;
    }

    private Agence validPersistedContext(Utilisateur user, Agence persistedContext) {
        if (!isPlatformAdmin(user) || persistedContext == null) {
            return null;
        }
        return persistedContext.getStatut() == StatutAgence.ACTIVE ? persistedContext : null;
    }

    private boolean isPlatformAdmin(Utilisateur user) {
        return user.getAgence() == null && "SUPER_ADMIN".equalsIgnoreCase(user.getRoleCode());
    }

    public record AuthSessionResult(AuthResponse response, String refreshToken) {
    }

    private String hashRefreshToken(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
