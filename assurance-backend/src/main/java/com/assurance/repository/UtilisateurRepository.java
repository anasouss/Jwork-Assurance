package com.assurance.repository;

import com.assurance.entity.Utilisateur;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UtilisateurRepository extends JpaRepository<Utilisateur, String> {
    @EntityGraph(attributePaths = {"agence", "role", "role.permissions"})
    Optional<Utilisateur> findByEmail(String email);

    @EntityGraph(attributePaths = {"agence", "role", "role.permissions"})
    Optional<Utilisateur> findById(String id);
}
