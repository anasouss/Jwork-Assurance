package com.assurance.repository;

import com.assurance.entity.SinistreCouverture;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SinistreCouvertureRepository extends JpaRepository<SinistreCouverture, Long> {

    Optional<SinistreCouverture> findBySinistreId(Long sinistreId);
}
