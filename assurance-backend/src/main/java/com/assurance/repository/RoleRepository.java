package com.assurance.repository;

import com.assurance.entity.Role;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoleRepository extends JpaRepository<Role, Long> {
    @EntityGraph(attributePaths = {"agence", "permissions"})
    List<Role> findAllByOrderByNomAsc();

    @EntityGraph(attributePaths = {"agence", "permissions"})
    List<Role> findByAgenceIdOrAgenceIsNullOrderByNomAsc(Long agenceId);

    @EntityGraph(attributePaths = {"agence", "permissions"})
    Optional<Role> findByAgenceIdAndCode(Long agenceId, String code);

    @EntityGraph(attributePaths = {"agence", "permissions"})
    Optional<Role> findByAgenceIsNullAndCode(String code);

    boolean existsByAgenceIdAndCodeIgnoreCase(Long agenceId, String code);

    boolean existsByAgenceIdAndCodeIgnoreCaseAndIdNot(Long agenceId, String code, Long id);

    boolean existsByAgenceIsNullAndCodeIgnoreCase(String code);

    boolean existsByAgenceIsNullAndCodeIgnoreCaseAndIdNot(String code, Long id);
}
