package com.assurance.repository;

import com.assurance.enums.TypePrestataireSinistre;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PrestataireDirectoryRepositoryTest {
    @Test
    void searchBindsFiltersAndPaginatesOneUnionAcrossProviderTables() {
        var entityManager = mock(EntityManager.class);
        var count = mock(Query.class);
        var rows = mock(Query.class);
        when(entityManager.createNativeQuery(startsWith("SELECT COUNT(*)"))).thenReturn(count);
        when(entityManager.createNativeQuery(startsWith("SELECT provider_id"))).thenReturn(rows);
        when(count.getSingleResult()).thenReturn(9L);
        when(rows.getResultList()).thenReturn(List.of(new Object[]{1L, "EXPERT"}, new Object[]{1L, "GARAGE"}));
        var result = new PrestataireDirectoryRepository(entityManager).search(
                new PrestataireDirectoryRepository.Filter(7L, false, "50%_!", 8L, 9L, 11L, 10L), PageRequest.of(1, 2));
        assertThat(result.getTotalElements()).isEqualTo(9);
        assertThat(result.getContent()).containsExactly(
                new PrestataireDirectoryRepository.ProviderKey(TypePrestataireSinistre.EXPERT, 1L),
                new PrestataireDirectoryRepository.ProviderKey(TypePrestataireSinistre.GARAGE, 1L));
        for (Query query : List.of(count, rows)) {
            verify(query).setParameter("agency", 7L);
            verify(query).setParameter("domain", 10L);
            verify(query).setParameter("branch", 11L);
            verify(query).setParameter("company", 9L);
            verify(query).setParameter("city", 8L);
            verify(query).setParameter("search", "%50!%!_!!%");
        }
        verify(rows).setFirstResult(2);
        verify(rows).setMaxResults(2);
        verify(entityManager).createNativeQuery(argThat(sql -> sql.startsWith("SELECT provider_id")
                && sql.contains("garages_sinistre p WHERE p.agence_id = :agency")
                && sql.contains("experts_sinistre p WHERE p.agence_id = :agency")
                && sql.contains("prestataires_medicaux_sinistre p WHERE p.agence_id = :agency")
                && sql.contains("op.type_prestataire = p.type_prestataire")
                && sql.contains("ORDER BY provider_name, provider_type, provider_id")
                && !sql.contains("50%_!")));
    }
}
