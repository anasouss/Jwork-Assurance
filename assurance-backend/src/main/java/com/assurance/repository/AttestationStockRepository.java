package com.assurance.repository;

import com.assurance.entity.AttestationStock;
import com.assurance.enums.StatutAttestationStock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AttestationStockRepository extends JpaRepository<AttestationStock, String> {
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
            @Param("compagnieId") String compagnieId,
            @Param("groupeUsageAttestationId") String groupeUsageAttestationId
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
            @Param("compagnieId") String compagnieId,
            @Param("groupeUsageAttestationId") String groupeUsageAttestationId
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
            @Param("compagnieId") String compagnieId,
            @Param("groupeUsageAttestationId") String groupeUsageAttestationId
    );

    Optional<AttestationStock> findByNumeroIgnoreCase(String numero);
}
