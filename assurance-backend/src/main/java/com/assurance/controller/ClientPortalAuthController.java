package com.assurance.controller;

import com.assurance.dto.request.ClientPortalRequests;
import com.assurance.dto.response.*;
import com.assurance.service.ClientPortalAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/client-portal/auth")
@RequiredArgsConstructor
public class ClientPortalAuthController {
    private final ClientPortalAuthService service;

    @PostMapping("/login")
    public ApiResponse<ClientPortalResponses.Tokens> login(@Valid @RequestBody ClientPortalRequests.Login request) {
        return ApiResponse.success(service.login(request));
    }

    @PostMapping("/refresh")
    public ApiResponse<ClientPortalResponses.Tokens> refresh(@Valid @RequestBody ClientPortalRequests.Refresh request) {
        return ApiResponse.success(service.refresh(request.refreshToken()));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@Valid @RequestBody ClientPortalRequests.Refresh request) {
        service.logout(request.refreshToken());
        return ApiResponse.success(null);
    }

    @GetMapping("/me")
    @PreAuthorize("hasAuthority('CLIENT_PORTAL')")
    public ApiResponse<ClientPortalResponses.Profile> me() {
        return ApiResponse.success(service.profile());
    }

    @PostMapping("/password")
    @PreAuthorize("hasAuthority('CLIENT_PORTAL')")
    public ApiResponse<Void> password(@Valid @RequestBody ClientPortalRequests.ChangePassword request) {
        service.changePassword(request);
        return ApiResponse.success(null, "Mot de passe modifié. Reconnectez-vous.");
    }
}
