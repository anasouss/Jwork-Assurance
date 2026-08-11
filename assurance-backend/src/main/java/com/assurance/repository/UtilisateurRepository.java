package com.assurance.repository;

import com.assurance.entity.Utilisateur;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UtilisateurRepository extends JpaRepository<Utilisateur, Long> {
    @EntityGraph(attributePaths = {"agence", "role", "role.permissions"})
    Optional<Utilisateur> findByEmail(String email);

    @EntityGraph(attributePaths = {"agence", "role", "role.permissions"})
    Optional<Utilisateur> findById(Long id);

    @EntityGraph(attributePaths = {"agence", "role", "role.permissions"})
    List<Utilisateur> findAllByOrderByNomAscPrenomAsc();

    @EntityGraph(attributePaths = {"agence", "role", "role.permissions"})
    List<Utilisateur> findByAgenceIdOrderByNomAscPrenomAsc(Long agenceId);

    @EntityGraph(attributePaths = {"role", "role.permissions"})
    List<Utilisateur> findByRole_CodeIgnoreCaseOrderByNomAscPrenomAsc(String roleCode);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<Utilisateur> findByRole_CodeIgnoreCaseAndActifTrue(String roleCode);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);

    boolean existsByRoleId(Long roleId);

    @Query("""
            select u.agence.id,
                   count(u),
                   sum(case when u.actif = true then 1 else 0 end)
            from Utilisateur u
            where u.agence is not null
              and (:agenceId is null or u.agence.id = :agenceId)
            group by u.agence.id
            """)
    List<Object[]> countUsersByAgency(@Param("agenceId") Long agenceId);
}
