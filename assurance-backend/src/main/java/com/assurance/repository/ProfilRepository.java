package com.assurance.repository;

import com.assurance.entity.Profil;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProfilRepository extends JpaRepository<Profil, String> {
    @EntityGraph(attributePaths = {"agence", "permissions"})
    List<Profil> findAllByOrderByNomAsc();

    @EntityGraph(attributePaths = {"agence", "permissions"})
    List<Profil> findByAgenceIdOrAgenceIsNullOrderByNomAsc(String agenceId);

    @EntityGraph(attributePaths = {"agence", "permissions"})
    Optional<Profil> findByAgenceIdAndCode(String agenceId, String code);

    @EntityGraph(attributePaths = {"agence", "permissions"})
    Optional<Profil> findByAgenceIsNullAndCode(String code);

    boolean existsByAgenceIdAndCodeIgnoreCase(String agenceId, String code);

    boolean existsByAgenceIdAndCodeIgnoreCaseAndIdNot(String agenceId, String code, String id);

    boolean existsByAgenceIsNullAndCodeIgnoreCase(String code);

    boolean existsByAgenceIsNullAndCodeIgnoreCaseAndIdNot(String code, String id);
}
