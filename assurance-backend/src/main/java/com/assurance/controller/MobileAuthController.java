package com.assurance.controller;

import com.assurance.dto.request.ClientPortalRequests;
import com.assurance.dto.request.LoginRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.AuthResponse;
import com.assurance.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/mobile/auth")
@RequiredArgsConstructor
public class MobileAuthController {
    private final AuthService auth;

    @PostMapping("/login")
    public ApiResponse<MobileSession> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        var session = auth.loginMobile(request, httpRequest);
        return ApiResponse.success(new MobileSession(session.response(), session.refreshToken()));
    }

    @PostMapping("/refresh")
    public ApiResponse<MobileSession> refresh(@Valid @RequestBody ClientPortalRequests.Refresh request,
                                             HttpServletRequest httpRequest) {
        var session = auth.refreshMobile(request.refreshToken(), httpRequest);
        return ApiResponse.success(new MobileSession(session.response(), session.refreshToken()));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@Valid @RequestBody ClientPortalRequests.Refresh request) {
        auth.logout(request.refreshToken());
        return ApiResponse.success(null);
    }

    public record MobileSession(AuthResponse auth, String refreshToken) {
    }
}
