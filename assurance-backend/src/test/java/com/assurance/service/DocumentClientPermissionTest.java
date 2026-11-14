package com.assurance.service;

import com.assurance.entity.Convention;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.EcheanceFacturationConvention;
import com.assurance.entity.LigneDocumentClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;

class DocumentClientPermissionTest {
    private final DocumentClientService service = mock(DocumentClientService.class, CALLS_REAL_METHODS);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void clientDocumentGrantCannotReadOrDeleteAConventionInvoice() {
        DocumentClient document = DocumentClient.builder().conventionPayeur(new Convention()).build();
        authenticate("document-client:view", "document-client:delete");
        assertThatThrownBy(() -> service.requireDocumentPermission(document, "view"))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.requireDocumentPermission(document, "delete"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void historicalConventionScheduleIsAlsoAnAuthoritativeOrigin() {
        DocumentClient document = DocumentClient.builder().lignes(List.of(LigneDocumentClient.builder()
                .echeanceFacturationConvention(new EcheanceFacturationConvention()).build())).build();
        authenticate("facture-convention:view");
        assertThatCode(() -> service.requireDocumentPermission(document, "view")).doesNotThrowAnyException();
        assertThatThrownBy(() -> service.requireDocumentPermission(document, "cancel"))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.requireDocumentPermission(DocumentClient.builder().build(), "view"))
                .isInstanceOf(AccessDeniedException.class);
    }

    private void authenticate(String... permissions) {
        String[] authorities = java.util.Arrays.stream(permissions).map(code -> "PERM_" + code).toArray(String[]::new);
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("actor", "unused", authorities));
    }
}
