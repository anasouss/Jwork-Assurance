package com.assurance.controller;

import com.assurance.dto.request.LoginRequest;
import com.assurance.dto.request.ChangePasswordRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.AuthResponse;
import com.assurance.dto.response.AgencyContextOptionResponse;
import com.assurance.dto.response.SessionResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.AuthService;
import com.assurance.service.AuthService.AuthSessionResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String REFRESH_COOKIE = "assurance_refresh";

    private final AuthService authService;

    @Value("${app.security.refresh-cookie-secure:true}")
    private boolean refreshCookieSecure;

    @Value("${jwt.refresh-token-expiration-web}")
    private long refreshTokenExpiration;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @RequestHeader("X-Auth-Request") String authRequest,
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest) {
        return authResponse(authService.login(request, httpRequest), "Connexion reussie");
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(
            @RequestHeader("X-Auth-Request") String authRequest,
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshCookie,
            HttpServletRequest httpRequest) {
        return authResponse(authService.refreshToken(refreshCookie, httpRequest), null);
    }

    @DeleteMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @RequestHeader("X-Auth-Request") String authRequest,
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshCookie) {
        authService.logout(refreshCookie);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, expiredRefreshCookie().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.success(null, "Deconnexion reussie"));
    }

    @GetMapping("/sessions")
    public ResponseEntity<ApiResponse<List<SessionResponse>>> sessions() {
        return ResponseEntity.ok(ApiResponse.success(
                authService.getActiveSessions(
                        TenantContext.getCurrentUser(),
                        TenantContext.getCurrentSession()
                )
        ));
    }

    @GetMapping("/agency-context/options")
    public ResponseEntity<ApiResponse<List<AgencyContextOptionResponse>>> agencyContextOptions() {
        return ResponseEntity.ok(ApiResponse.success(
                authService.getAgencyContextOptions(TenantContext.getCurrentUser())
        ));
    }

    @PostMapping("/agency-context/{agenceId}")
    public ResponseEntity<ApiResponse<AuthResponse>> enterAgencyContext(
            @PathVariable Long agenceId,
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshCookie
    ) {
        return noStore(ApiResponse.success(
                authService.enterAgencyContext(
                        TenantContext.getCurrentUser(),
                        TenantContext.getCurrentSession(),
                        refreshCookie,
                        agenceId
                ),
                "Contexte agence activé"
        ));
    }

    @DeleteMapping("/agency-context")
    public ResponseEntity<ApiResponse<AuthResponse>> exitAgencyContext(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshCookie
    ) {
        return noStore(ApiResponse.success(
                authService.exitAgencyContext(
                        TenantContext.getCurrentUser(),
                        TenantContext.getCurrentSession(),
                        refreshCookie
                ),
                "Retour à la plateforme"
        ));
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<Void>> revokeSession(@PathVariable Long sessionId) {
        authService.revokeSession(TenantContext.getCurrentUser(), sessionId);
        return ResponseEntity.ok(ApiResponse.success(null, "Session revoquee"));
    }

    @DeleteMapping("/sessions/others")
    public ResponseEntity<ApiResponse<Void>> revokeOtherSessions() {
        authService.revokeOtherSessions(
                TenantContext.getCurrentUser(),
                TenantContext.getCurrentSession()
        );
        return ResponseEntity.ok(ApiResponse.success(null, "Autres sessions revoquees"));
    }

    @PostMapping("/password")
    public ResponseEntity<ApiResponse<Void>> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(TenantContext.getCurrentUser(), request);
        return ResponseEntity.ok(ApiResponse.success(null, "Mot de passe modifie"));
    }

    private ResponseEntity<ApiResponse<AuthResponse>> authResponse(AuthSessionResult session, String message) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE, session.refreshToken())
                .httpOnly(true)
                .secure(refreshCookieSecure)
                .sameSite("Strict")
                .path("/api/v1/auth")
                .maxAge(refreshTokenExpiration / 1000)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.PRAGMA, "no-cache")
                .body(ApiResponse.success(session.response(), message));
    }

    private ResponseCookie expiredRefreshCookie() {
        return ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(refreshCookieSecure)
                .sameSite("Strict")
                .path("/api/v1/auth")
                .maxAge(0)
                .build();
    }

    private ResponseEntity<ApiResponse<AuthResponse>> noStore(ApiResponse<AuthResponse> response) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.PRAGMA, "no-cache")
                .body(response);
    }

}
