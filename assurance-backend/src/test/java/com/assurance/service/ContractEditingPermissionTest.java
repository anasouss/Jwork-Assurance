package com.assurance.service;

import com.assurance.entity.Contrat;
import com.assurance.enums.StatutContrat;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;

class ContractEditingPermissionTest {
    private final ContratService service = mock(ContratService.class, CALLS_REAL_METHODS);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void creationCannotCorrectAnActiveContract() {
        authenticate("contrat:create");
        Contrat active = Contrat.builder().statut(StatutContrat.ACTIVE).build();
        assertThatThrownBy(() -> authorize(active)).isInstanceOf(AccessDeniedException.class);
        authenticate("contrat:update");
        assertThatCode(() -> authorize(active)).doesNotThrowAnyException();
    }

    @Test
    void renewalDraftRequiresRenewalRatherThanGeneralEditing() {
        Contrat renewal = Contrat.builder().statut(StatutContrat.DRAFT).brouillon(true)
                .contratOrigine(new Contrat()).build();
        authenticate("contrat:update");
        assertThatThrownBy(() -> authorize(renewal)).isInstanceOf(AccessDeniedException.class);
        authenticate("contrat:renew");
        assertThatCode(() -> authorize(renewal)).doesNotThrowAnyException();
        assertThatThrownBy(() -> authorize(Contrat.builder().statut(StatutContrat.DRAFT).brouillon(true).build()))
                .isInstanceOf(AccessDeniedException.class);
    }

    private void authorize(Contrat contrat) {
        ReflectionTestUtils.invokeMethod(service, "requireContractEditingPermission", contrat);
    }

    private void authenticate(String code) {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("actor", "unused", "PERM_" + code));
    }
}
