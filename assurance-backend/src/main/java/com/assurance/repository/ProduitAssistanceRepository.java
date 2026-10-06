package com.assurance.repository;

import com.assurance.entity.ProduitAssistance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProduitAssistanceRepository extends JpaRepository<ProduitAssistance, Long> {
    List<ProduitAssistance> findByCompagnieAssistanceIdAndActifTrueOrderByLibelleAsc(Long compagnieAssistanceId);

    @Query("""
            select distinct produit
            from ProduitAssistance produit
            left join produit.compagnieAssistance compagnie
            left join produit.categorieClient categorie
            left join produit.usages usage
            where (:actif is null or produit.actif = :actif)
              and (:compagnieAssistanceId is null or compagnie.id = :compagnieAssistanceId)
              and (:categorieClientId is null or categorie.id is null or categorie.id = :categorieClientId)
              and (:usageId is null or produit.usages is empty or usage.id = :usageId)
              and (:type is null or lower(produit.type) = lower(:type))
              and (
                    :recherche is null
                    or lower(produit.libelle) like lower(concat('%', :recherche, '%'))
                    or lower(produit.type) like lower(concat('%', :recherche, '%'))
                    or lower(compagnie.nom) like lower(concat('%', :recherche, '%'))
                    or lower(categorie.libelle) like lower(concat('%', :recherche, '%'))
                    or lower(produit.prestations) like lower(concat('%', :recherche, '%'))
                    or lower(usage.code) like lower(concat('%', :recherche, '%'))
              )
            order by lower(produit.libelle)
            """)
    List<ProduitAssistance> search(
            @Param("recherche") String recherche,
            @Param("compagnieAssistanceId") Long compagnieAssistanceId,
            @Param("type") String type,
            @Param("categorieClientId") Long categorieClientId,
            @Param("usageId") Long usageId,
            @Param("actif") Boolean actif
    );
}
