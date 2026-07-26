package com.assurance.repository;

import com.assurance.entity.Role;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoleRepository extends JpaRepository<Role, String> {
    @EntityGraph(attributePaths = {"agence", "permissions"})
    List<Role> findAllByOrderByNomAsc();

    @EntityGraph(attributePaths = {"agence", "permissions"})
    List<Role> findByAgenceIdOrAgenceIsNullOrderByNomAsc(String agenceId);

    @EntityGraph(attributePaths = {"agence", "permissions"})
    Optional<Role> findByAgenceIdAndCode(String agenceId, String code);

    @EntityGraph(attributePaths = {"agence", "permissions"})
    Optional<Role> findByAgenceIsNullAndCode(String code);

    boolean existsByAgenceIdAndCodeIgnoreCase(String agenceId, String code);

    boolean existsByAgenceIdAndCodeIgnoreCaseAndIdNot(String agenceId, String code, String id);

    boolean existsByAgenceIsNullAndCodeIgnoreCase(String code);

    boolean existsByAgenceIsNullAndCodeIgnoreCaseAndIdNot(String code, String id);
}
