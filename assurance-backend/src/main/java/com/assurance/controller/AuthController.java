package com.assurance.controller;

import com.assurance.dto.request.LoginRequest;
import com.assurance.dto.request.RefreshTokenRequest;
import com.assurance.dto.request.ChangePasswordRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.AuthResponse;
import com.assurance.dto.response.SessionResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponse.success(authService.login(request, httpRequest), "Connexion reussie"));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(
            @Valid @RequestBody RefreshTokenRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponse.success(authService.refreshToken(request.getRefreshToken(), httpRequest)));
    }

    @DeleteMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(@RequestBody(required = false) RefreshTokenRequest request) {
        authService.logout(request == null ? null : request.getRefreshToken());
        return ResponseEntity.ok(ApiResponse.success(null, "Deconnexion reussie"));
    }

    @GetMapping("/sessions")
    public ResponseEntity<ApiResponse<List<SessionResponse>>> sessions() {
        return ResponseEntity.ok(ApiResponse.success(
                authService.getActiveSessions(TenantContext.getCurrentUser(), null)
        ));
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<Void>> revokeSession(@PathVariable Long sessionId) {
        authService.revokeSession(TenantContext.getCurrentUser(), sessionId);
        return ResponseEntity.ok(ApiResponse.success(null, "Session revoquee"));
    }

    @PostMapping("/password")
    public ResponseEntity<ApiResponse<Void>> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(TenantContext.getCurrentUser(), request);
        return ResponseEntity.ok(ApiResponse.success(null, "Mot de passe modifie"));
    }
}
