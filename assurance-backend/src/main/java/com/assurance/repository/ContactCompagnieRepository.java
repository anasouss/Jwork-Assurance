package com.assurance.repository;

import com.assurance.entity.ContactCompagnie;
import com.assurance.enums.ServiceContactCompagnie;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ContactCompagnieRepository extends JpaRepository<ContactCompagnie, Long> {

    @EntityGraph(attributePaths = "compagnieAssurance")
    @Query("""
            select contact from ContactCompagnie contact
            where contact.agence.id = :agenceId
              and (:compagnieId is null or contact.compagnieAssurance.id = :compagnieId)
              and (:service is null or contact.service = :service)
              and (:actif is null or contact.actif = :actif)
              and (:search is null
                   or lower(contact.nom) like :search
                   or lower(coalesce(contact.prenom, '')) like :search
                   or lower(coalesce(contact.fonction, '')) like :search
                   or lower(coalesce(contact.email, '')) like :search
                   or lower(coalesce(contact.telephoneMobile, '')) like :search
                   or lower(coalesce(contact.telephoneFixe, '')) like :search
                   or lower(contact.compagnieAssurance.nom) like :search
                   or lower(contact.compagnieAssurance.code) like :search)
            """)
    Page<ContactCompagnie> search(
            @Param("agenceId") Long agenceId,
            @Param("compagnieId") Long compagnieId,
            @Param("service") ServiceContactCompagnie service,
            @Param("actif") Boolean actif,
            @Param("search") String search,
            Pageable pageable
    );

    @EntityGraph(attributePaths = "compagnieAssurance")
    Optional<ContactCompagnie> findByIdAndAgenceId(Long id, Long agenceId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update ContactCompagnie contact
               set contact.principal = false
             where contact.agence.id = :agenceId
               and contact.compagnieAssurance.id = :compagnieId
               and contact.service = :service
               and contact.principal = true
               and (:excludedId is null or contact.id <> :excludedId)
            """)
    void clearOtherPrincipalContacts(
            @Param("agenceId") Long agenceId,
            @Param("compagnieId") Long compagnieId,
            @Param("service") ServiceContactCompagnie service,
            @Param("excludedId") Long excludedId
    );
}
