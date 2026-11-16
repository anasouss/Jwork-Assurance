package com.assurance.service;

import com.assurance.dto.request.ConventionProductionFilter;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.Convention;
import com.assurance.enums.CategorieMouvementContrat;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ConventionRepository;
import com.assurance.repository.ElementFacturableRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConventionProductionMultiFilterTest {
    @Mock private ConventionRepository conventions;
    @Mock private ElementFacturableRepository elements;
    @InjectMocks private ConventionProductionService service;

    @Test
    void normalizesMultiSelectionAndKeepsLegacyFiltersCompatible() {
        var filter = filter();
        filter.setConventionId(2L);
        filter.setConventionIds(List.of(2L, 3L, 3L));
        filter.setCategorieMouvement(CategorieMouvementContrat.AFFAIRE_NOUVELLE);
        filter.setCategoriesMouvement(List.of(CategorieMouvementContrat.AVENANT, CategorieMouvementContrat.AVENANT));
        assertThat(filter.selectedConventionIds()).containsExactly(2L, 3L);
        assertThat(filter.selectedMovementCategories()).containsExactly(CategorieMouvementContrat.AFFAIRE_NOUVELLE, CategorieMouvementContrat.AVENANT);
    }

    @Test
    void emptySelectionMeansAll() {
        var filter = filter();
        filter.setConventionIds(List.of());
        filter.setCategoriesMouvement(List.of());
        assertThat(filter.selectedConventionIds()).isEmpty();
        assertThat(filter.selectedMovementCategories()).isEmpty();
    }

    @Test
    void validatesEveryConventionAgainstTheCurrentAgency() {
        var filter = filter();
        filter.setConventionIds(List.of(2L, 3L));
        when(conventions.findByAgenceIdAndId(7L, 2L)).thenReturn(Optional.of(convention(20L)));
        when(conventions.findByAgenceIdAndId(7L, 3L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.search(7L, filter, 0, 25)).isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(elements);
    }

    @Test
    void differentLinkedCompaniesDoNotForceASingleCompany() {
        var filter = filter();
        filter.setConventionIds(List.of(2L, 3L));
        when(conventions.findByAgenceIdAndId(7L, 2L)).thenReturn(Optional.of(convention(20L)));
        when(conventions.findByAgenceIdAndId(7L, 3L)).thenReturn(Optional.of(convention(30L)));
        when(elements.findAll(any(Specification.class), any(Pageable.class))).thenReturn(Page.empty());
        service.search(7L, filter, 0, 25);
        assertThat(filter.getCompagnieId()).isNull();
    }

    @Test
    void rejectsACompanyIncompatibleWithAnySelectedConvention() {
        var filter = filter();
        filter.setConventionIds(List.of(2L, 3L));
        filter.setCompagnieId(20L);
        when(conventions.findByAgenceIdAndId(7L, 2L)).thenReturn(Optional.of(convention(20L)));
        when(conventions.findByAgenceIdAndId(7L, 3L)).thenReturn(Optional.of(convention(30L)));
        assertThatThrownBy(() -> service.search(7L, filter, 0, 25)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(elements);
    }

    private ConventionProductionFilter filter() {
        var filter = new ConventionProductionFilter();
        filter.setDateDu(LocalDate.of(2026, 1, 1));
        filter.setDateAu(LocalDate.of(2026, 12, 31));
        return filter;
    }

    private Convention convention(Long companyId) {
        var company = CompagnieAssurance.builder().build();
        company.setId(companyId);
        return Convention.builder().compagnieAssurance(company).build();
    }
}
