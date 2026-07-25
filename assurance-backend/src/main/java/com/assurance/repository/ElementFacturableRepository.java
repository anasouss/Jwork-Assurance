package com.assurance.repository;

import com.assurance.entity.ElementFacturable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ElementFacturableRepository extends JpaRepository<ElementFacturable, String> {
    List<ElementFacturable> findByAgenceIdOrderByCreatedAtDesc(String agenceId);

    List<ElementFacturable> findByContratIdOrderByCreatedAtDesc(String contratId);
}
