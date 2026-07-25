package com.assurance.repository;

import com.assurance.entity.Profil;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProfilRepository extends JpaRepository<Profil, String> {
    Optional<Profil> findByAgenceIdAndCode(String agenceId, String code);
    Optional<Profil> findByAgenceIsNullAndCode(String code);
}
