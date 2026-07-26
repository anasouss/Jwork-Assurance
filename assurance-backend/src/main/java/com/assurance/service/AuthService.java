package com.assurance.service;

import com.assurance.dto.request.LoginRequest;
import com.assurance.dto.request.ChangePasswordRequest;
import com.assurance.dto.response.AuthResponse;
import com.assurance.dto.response.SessionResponse;
import com.assurance.entity.RefreshSession;
import com.assurance.entity.Utilisateur;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.UnauthorizedException;
import com.assurance.repository.RefreshSessionRepository;
import com.assurance.repository.UtilisateurRepository;
import com.assurance.security.JwtTokenProvider;
import com.assurance.security.UserPrincipal;
import com.assurance.util.DeviceInfoParser;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UtilisateurRepository userRepository;
    private final RefreshSessionRepository refreshTokenRepository;
    private final JwtTokenProvider tokenProvider;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public AuthResponse login(LoginRequest request, HttpServletRequest httpRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        Utilisateur user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));
        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);
        return createSession(user, httpRequest);
    }

    @Transactional
    public AuthResponse refreshToken(String token, HttpServletRequest httpRequest) {
        RefreshSession refreshToken = refreshTokenRepository.findByToken(token)
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));
        if (!refreshToken.isValid()) {
            throw new UnauthorizedException("Refresh token expired");
        }
        refreshToken.setRevoked(true);
        refreshTokenRepository.save(refreshToken);
        return createSession(refreshToken.getUser(), httpRequest);
    }

    @Transactional
    public void logout(String token) {
        if (token == null || token.isBlank()) {
            return;
        }
        refreshTokenRepository.findByToken(token).ifPresent(found -> {
            found.setRevoked(true);
            refreshTokenRepository.save(found);
        });
    }

    @Transactional(readOnly = true)
    public List<SessionResponse> getActiveSessions(String userId, String currentSessionId) {
        return refreshTokenRepository
                .findByUserIdAndRevokedFalseAndExpiresAtAfterOrderByLastActivityAtDesc(userId, LocalDateTime.now())
                .stream()
                .map(session -> SessionResponse.builder()
                        .id(session.getId())
                        .deviceName(session.getDeviceName())
                        .deviceType(session.getDeviceType())
                        .ipAddress(session.getIpAddress())
                        .current(currentSessionId != null && currentSessionId.equals(session.getId()))
                        .lastActivityAt(session.getLastActivityAt())
                        .createdAt(session.getCreatedAt())
                        .build())
                .toList();
    }

    @Transactional
    public void revokeSession(String userId, String sessionId) {
        RefreshSession session = refreshTokenRepository.findById(sessionId)
                .orElseThrow(() -> new BadRequestException("Session not found"));
        if (!session.getUser().getId().equals(userId)) {
            throw new UnauthorizedException("You cannot revoke this session");
        }
        session.setRevoked(true);
        refreshTokenRepository.save(session);
    }

    @Transactional
    public void changePassword(String userId, ChangePasswordRequest request) {
        Utilisateur user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("Utilisateur non authentifie"));
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new BadRequestException("Mot de passe actuel incorrect");
        }
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        refreshTokenRepository.revokeAllByUserId(userId);
    }

    private AuthResponse createSession(Utilisateur user, HttpServletRequest request) {
        String accessToken = tokenProvider.generateAccessToken(user);
        String refreshTokenValue = tokenProvider.generateRefreshToken();
        RefreshSession refreshToken = RefreshSession.builder()
                .user(user)
                .token(refreshTokenValue)
                .expiresAt(LocalDateTime.now().plusSeconds(30L * 24 * 60 * 60))
                .ipAddress(DeviceInfoParser.getClientIp(request))
                .userAgent(DeviceInfoParser.buildUserAgent(request))
                .deviceName(DeviceInfoParser.parseDeviceName(request))
                .deviceType(DeviceInfoParser.parseDeviceType(request))
                .lastActivityAt(LocalDateTime.now())
                .build();
        refreshTokenRepository.save(refreshToken);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenValue)
                .sessionId(refreshToken.getId())
                .tokenType("Bearer")
                .expiresIn(tokenProvider.getAccessTokenExpirationInSeconds())
                .user(AuthResponse.UtilisateurInfo.builder()
                        .id(user.getId())
                        .email(user.getEmail())
                        .fullName(user.getFullName())
                        .roleCode(user.getProfilCode())
                        .roleName(user.getRole() != null ? user.getRole().getNom() : null)
                        .agenceId(user.getAgence() != null ? user.getAgence().getId() : null)
                        .agenceName(user.getAgence() != null ? user.getAgence().getNom() : null)
                        .permissions(user.getPermissions())
                        .build())
                .build();
    }
}
