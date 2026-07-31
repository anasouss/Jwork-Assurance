package com.assurance.repository;

import com.assurance.entity.Utilisateur;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

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
    List<Utilisateur> findByRoleCodeIgnoreCaseOrderByNomAscPrenomAsc(String roleCode);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<Utilisateur> findByRoleCodeIgnoreCaseAndActifTrue(String roleCode);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);

    boolean existsByRoleId(Long roleId);
}
