package com.assurance.service;

import com.assurance.dto.request.LoginRequest;
import com.assurance.dto.request.MobileLoginRequest;
import com.assurance.dto.response.AuthResponse;
import com.assurance.dto.response.ClientPortalResponses;
import com.assurance.exception.UnauthorizedException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MobileLoginService {
    private final AuthService staffAuth;
    private final ClientPortalAuthService clientAuth;

    public Result login(MobileLoginRequest request, HttpServletRequest httpRequest) {
        String identifier = request.identifiant().strip();
        // Portal identifiers cannot contain @. Never try another account type after a failed password.
        if (identifier.contains("@")) {
            LoginRequest credentials = new LoginRequest();
            credentials.setEmail(identifier);
            credentials.setPassword(request.password());
            try {
                var session = staffAuth.loginMobile(credentials, httpRequest);
                return new Result(PrincipalType.STAFF,
                        new StaffSession(session.response(), session.refreshToken()), null);
            } catch (AuthenticationException | UnauthorizedException invalid) {
                throw new UnauthorizedException("Identifiants ou session invalides");
            }
        }
        return new Result(PrincipalType.CLIENT, null, clientAuth.loginMobile(identifier, request.password()));
    }

    public enum PrincipalType {
        STAFF,
        CLIENT
    }

    public record StaffSession(AuthResponse auth, String refreshToken) {
    }

    public record Result(PrincipalType principalType, StaffSession staff, ClientPortalResponses.Tokens client) {
    }
}
