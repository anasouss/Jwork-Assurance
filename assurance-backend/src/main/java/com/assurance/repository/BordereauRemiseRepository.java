package com.assurance.repository;

import com.assurance.entity.BordereauRemise;
import com.assurance.enums.StatutBordereauRemise;
import com.assurance.enums.TypeBordereauRemise;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface BordereauRemiseRepository extends JpaRepository<BordereauRemise, Long> {

    @EntityGraph(attributePaths = {
            "compteDestination", "compteDestination.banqueReference", "compteSource"
    })
    @Query("""
            select b
            from BordereauRemise b
            where b.agence.id = :agenceId
              and (:type is null or b.type = :type)
              and (:statut is null or b.statut = :statut
                   or (:statut = com.assurance.enums.StatutBordereauRemise.DEPOSE
                       and b.statut = com.assurance.enums.StatutBordereauRemise.PARTIELLEMENT_TRAITE))
              and (:definitif is null
                   or (:definitif = false and b.statut = com.assurance.enums.StatutBordereauRemise.BROUILLON)
                   or (:definitif = true and b.statut in (
                       com.assurance.enums.StatutBordereauRemise.DEPOSE,
                       com.assurance.enums.StatutBordereauRemise.PARTIELLEMENT_TRAITE,
                       com.assurance.enums.StatutBordereauRemise.CLOTURE)))
              and (:dateDu is null or b.dateBordereau >= :dateDu)
              and (:dateAu is null or b.dateBordereau <= :dateAu)
              and (:search is null
                   or lower(b.numero) like lower(concat('%', :search, '%'))
                   or lower(coalesce(b.referenceBancaire, '')) like lower(concat('%', :search, '%'))
                   or lower(b.compteDestination.libelle) like lower(concat('%', :search, '%')))
            order by b.dateBordereau desc, b.id desc
            """)
    Page<BordereauRemise> search(
            @Param("agenceId") Long agenceId,
            @Param("type") TypeBordereauRemise type,
            @Param("statut") StatutBordereauRemise statut,
            @Param("definitif") Boolean definitif,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu,
            @Param("search") String search,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "compteDestination",
            "compteDestination.banqueReference",
            "compteSource",
            "lignes",
            "lignes.instrument",
            "lignes.instrument.banqueEmettriceReference",
            "lignes.instrument.reglement",
            "lignesEspeces",
            "lignesEspeces.mouvementTresorerie",
            "lignesEspeces.mouvementTresorerie.compteTresorerie",
            "lignesEspeces.mouvementTresorerie.compteTresorerie.utilisateurTitulaire",
            "lignesEspeces.operationTresorerie"
    })
    Optional<BordereauRemise> findByIdAndAgenceId(Long id, Long agenceId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {
            "compteDestination",
            "compteDestination.banqueReference",
            "compteSource",
            "lignes",
            "lignes.instrument",
            "lignes.instrument.banqueEmettriceReference",
            "lignes.instrument.reglement",
            "lignesEspeces",
            "lignesEspeces.mouvementTresorerie",
            "lignesEspeces.mouvementTresorerie.compteTresorerie",
            "lignesEspeces.mouvementTresorerie.compteTresorerie.utilisateurTitulaire",
            "lignesEspeces.operationTresorerie"
    })
    @Query("""
            select b
            from BordereauRemise b
            where b.id = :id and b.agence.id = :agenceId
            """)
    Optional<BordereauRemise> findByIdAndAgenceIdForUpdate(
            @Param("id") Long id,
            @Param("agenceId") Long agenceId
    );
}
