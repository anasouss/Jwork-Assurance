package com.assurance.controller;

import com.assurance.config.SecurityConfig;
import com.assurance.security.*;
import com.assurance.service.*;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import java.util.List;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {ClientPortalController.class, ClientPortalManagementController.class})
@Import(SecurityConfig.class)
class ClientPortalSecurityTest {
    @Autowired MockMvc mvc;
    @MockBean ClientPortalReadService reads;
    @MockBean ClientPortalManagementService management;
    @MockBean JwtAuthenticationFilter jwt;
    @MockBean UserDetailsServiceImpl users;

    @BeforeEach
    void passThroughJwtForTestAuthentication() throws Exception {
        doAnswer(invocation -> {
            FilterChain chain = invocation.getArgument(2);
            chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(jwt).doFilter(any(ServletRequest.class), any(ServletResponse.class), any(FilterChain.class));
    }

    @Test
    void clientsCanReadPortalButCannotReachEmployeeApis() throws Exception {
        var auth = new UsernamePasswordAuthenticationToken(new ClientPortalPrincipal(1L, 2L, 3L), null,
                List.of(new SimpleGrantedAuthority("CLIENT_PORTAL")));
        mvc.perform(get("/api/v1/client-portal/dashboard").with(authentication(auth))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/client-accounts").with(authentication(auth))).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/client-accounts").with(authentication(auth)).contentType("application/json")
                .content("{}")).andExpect(status().isForbidden());
    }

    @Test
    void employeesCannotEnterClientSpaceAndAnonymousUsersCannotReadIt() throws Exception {
        mvc.perform(get("/api/v1/client-portal/dashboard").with(user("staff")
                .authorities(new SimpleGrantedAuthority("PERM_contrat:view")))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/client-portal/dashboard")).andExpect(status().isUnauthorized());
    }

    @Test
    void clientBusinessEndpointsHaveNoWriteHandlers() throws Exception {
        var auth = new UsernamePasswordAuthenticationToken(new ClientPortalPrincipal(1L, 2L, 3L), null,
                List.of(new SimpleGrantedAuthority("CLIENT_PORTAL")));
        mvc.perform(post("/api/v1/client-portal/contracts").with(authentication(auth))
                .contentType("application/json").content("{}")).andExpect(status().isMethodNotAllowed());
    }
}
