package com.assurance.service;

import com.assurance.dto.request.MobileLoginRequest;
import com.assurance.dto.response.ClientPortalResponses;
import com.assurance.exception.UnauthorizedException;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MobileLoginServiceTest {
    @Mock AuthService staffAuth;
    @Mock ClientPortalAuthService clientAuth;
    @Mock HttpServletRequest http;
    @InjectMocks MobileLoginService service;

    @Test
    void clientIdentifierUsesPortalAuthenticationWithoutEmployeeFallback() {
        var tokens = new ClientPortalResponses.Tokens("client-jwt", "refresh", "Bearer", 60L, null);
        when(clientAuth.loginMobile("AB123", "password")).thenReturn(tokens);
        var response = service.login(new MobileLoginRequest(" AB123 ", "password"), http);
        assertThat(response.principalType()).isEqualTo(MobileLoginService.PrincipalType.CLIENT);
        assertThat(response.client()).isSameAs(tokens);
        assertThat(response.staff()).isNull();
        verifyNoInteractions(staffAuth);
    }

    @Test
    void failedStaffLoginNeverFallsBackToPortalOrRevealsAccountStatus() {
        when(staffAuth.loginMobile(any(), eq(http))).thenThrow(new BadCredentialsException("Internal error"));
        assertThatThrownBy(() -> service.login(new MobileLoginRequest("staff@example.com", "wrong"), http))
                .isInstanceOf(UnauthorizedException.class).hasMessage("Identifiants ou session invalides");
        verifyNoInteractions(clientAuth);
    }
}
