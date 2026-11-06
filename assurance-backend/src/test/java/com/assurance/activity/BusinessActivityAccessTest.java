package com.assurance.activity;

import com.assurance.entity.BusinessActivity;
import com.assurance.repository.BusinessActivityRepository;
import com.assurance.security.TenantContext;
import com.assurance.security.UserPrincipal;
import com.assurance.service.BusinessActivityService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Root;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class BusinessActivityAccessTest {
    private final BusinessActivityRepository repository = mock(BusinessActivityRepository.class);
    private final BusinessActivityService service = new BusinessActivityService(repository, new ObjectMapper());

    @AfterEach
    void cleanup() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void permissionAloneDoesNotGrantBusinessHistoryToAnAgent() {
        login("AGENT", 7L, Set.of("activity:view"));
        denied();
    }

    @Test
    void administratorStillNeedsThePermission() {
        login("AGENCY_ADMIN", 7L, Set.of());
        denied();
    }

    @Test
    void agencyAdministratorCannotReadPlatformOrAnotherAgency() {
        login("AGENCY_ADMIN", 7L, Set.of("activity:view"));
        TenantContext.setCurrentAgence(null);
        denied();
        TenantContext.setCurrentAgence(8L);
        denied();
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void searchSpecificationUsesTheCurrentAgencyEvenWhenNoOtherFilterIsProvided() {
        login("AGENCY_ADMIN", 7L, Set.of("activity:view"));
        when(repository.searchSummaries(any(Specification.class), any(Pageable.class))).thenReturn(Page.empty());
        search();
        ArgumentCaptor<Specification<BusinessActivity>> specification = ArgumentCaptor.forClass(Specification.class);
        verify(repository).searchSummaries(specification.capture(), any(Pageable.class));
        Root<BusinessActivity> root = mock(Root.class);
        Path<Object> agency = mock(Path.class);
        Path<Object> id = mock(Path.class);
        CriteriaBuilder builder = mock(CriteriaBuilder.class);
        when(root.get("agence")).thenReturn(agency);
        when(agency.get("id")).thenReturn(id);
        specification.getValue().toPredicate(root, null, builder);
        verify(builder).equal(id, 7L);
    }

    @Test
    void detailUsesAgencyScopedLookupAndDoesNotFallBackToGlobalId() {
        login("AGENCY_ADMIN", 7L, Set.of("activity:view"));
        assertThatThrownBy(() -> service.detail(44L)).isInstanceOf(com.assurance.exception.ResourceNotFoundException.class);
        verify(repository).findByIdAndAgenceId(44L, 7L);
        org.mockito.Mockito.verify(repository, org.mockito.Mockito.never()).findById(any());
    }

    @Test
    void detailRequiresAdministratorAsWellAsPermission() {
        login("AGENT", 7L, Set.of("activity:view"));
        assertThatThrownBy(() -> service.detail(44L)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(repository);
    }

    private void login(String role, Long agency, Set<String> permissions) {
        UserPrincipal principal = new UserPrincipal(1L, "admin@example.test", "", role, agency, true, permissions);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        TenantContext.setCurrentAgence(agency);
    }

    private void denied() {
        assertThatThrownBy(this::search).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(repository);
    }

    private void search() {
        service.search(null, null, null, null, null, null, null, null, 0, 25);
    }
}
