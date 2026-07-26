package com.assurance.repository;

import com.assurance.entity.AttestationStock;
import com.assurance.enums.StatutAttestationStock;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AttestationStockRepository extends JpaRepository<AttestationStock, Long> {
    boolean existsByNumeroIgnoreCase(String numero);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a from AttestationStock a
            where upper(a.numero) in :numeros
              and a.actif = true
              and a.lot.actif = true
              and a.lot.livraison.actif = true
              and a.lot.livraison.validee = true
              and a.compagnieAssurance.id = :compagnieId
              and a.groupeUsageAttestation.id = :groupeUsageAttestationId
            """)
    List<AttestationStock> findGestionnableForUpdate(
            @Param("numeros") Collection<String> numeros,
            @Param("compagnieId") Long compagnieId,
            @Param("groupeUsageAttestationId") Long groupeUsageAttestationId
    );

    @Query("""
            select a.numero from AttestationStock a
            where upper(a.numero) like upper(concat('%', :fragment, '%'))
              and a.statut = :statut
              and a.actif = true
              and a.lot.actif = true
              and a.lot.livraison.actif = true
              and a.lot.livraison.validee = true
              and a.compagnieAssurance.id = :compagnieId
              and a.groupeUsageAttestation.id = :groupeUsageAttestationId
            order by a.numero asc
            """)
    List<String> findDisponibles(
            @Param("fragment") String fragment,
            @Param("statut") StatutAttestationStock statut,
            @Param("compagnieId") Long compagnieId,
            @Param("groupeUsageAttestationId") Long groupeUsageAttestationId
    );

    @Query("""
            select count(a) from AttestationStock a
            where a.statut = com.assurance.enums.StatutAttestationStock.DISPONIBLE
              and a.actif = true
              and a.lot.actif = true
              and a.lot.livraison.actif = true
              and a.lot.livraison.validee = true
              and a.compagnieAssurance.id = :compagnieId
              and a.groupeUsageAttestation.id = :groupeUsageAttestationId
            """)
    long countDisponibles(
            @Param("compagnieId") Long compagnieId,
            @Param("groupeUsageAttestationId") Long groupeUsageAttestationId
    );

    @Query("""
            select a.statut, count(a)
            from AttestationStock a
            where a.actif = true
              and a.lot.actif = true
              and a.lot.livraison.actif = true
              and a.lot.livraison.validee = true
            group by a.statut
            """)
    List<Object[]> countByStatutForDashboard();

    @Query("""
            select a.compagnieAssurance.id,
                   a.compagnieAssurance.nom,
                   a.groupeUsageAttestation.id,
                   a.groupeUsageAttestation.code,
                   a.groupeUsageAttestation.libelle,
                   a.statut,
                   count(a)
            from AttestationStock a
            where a.actif = true
              and a.lot.actif = true
              and a.lot.livraison.actif = true
              and a.lot.livraison.validee = true
              and a.groupeUsageAttestation.visibleStock = true
              and a.groupeUsageAttestation.actif = true
            group by a.compagnieAssurance.id,
                     a.compagnieAssurance.nom,
                     a.groupeUsageAttestation.id,
                     a.groupeUsageAttestation.code,
                     a.groupeUsageAttestation.libelle,
                     a.statut
            order by a.compagnieAssurance.nom asc, a.groupeUsageAttestation.code asc
            """)
    List<Object[]> countByCompanyAndGroupForDashboard();

    @Query("""
            select a from AttestationStock a
            join fetch a.compagnieAssurance
            join fetch a.groupeUsageAttestation
            join fetch a.lot lot
            join fetch lot.livraison livraison
            where a.actif = true
              and lot.actif = true
              and livraison.actif = true
              and livraison.validee = true
              and (:numero is null or upper(a.numero) like upper(concat('%', :numero, '%')))
              and (:compagnieId is null or a.compagnieAssurance.id = :compagnieId)
              and (:groupeUsageAttestationId is null or a.groupeUsageAttestation.id = :groupeUsageAttestationId)
              and (:statut is null or a.statut = :statut)
            order by a.numero asc
            """)
    List<AttestationStock> searchGestionStock(
            @Param("numero") String numero,
            @Param("compagnieId") Long compagnieId,
            @Param("groupeUsageAttestationId") Long groupeUsageAttestationId,
            @Param("statut") StatutAttestationStock statut,
            Pageable pageable
    );

    Optional<AttestationStock> findByNumeroIgnoreCase(String numero);
}
