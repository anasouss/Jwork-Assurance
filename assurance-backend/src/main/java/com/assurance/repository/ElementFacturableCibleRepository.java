package com.assurance.repository;

import com.assurance.entity.ElementFacturableCible;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.List;

public interface ElementFacturableCibleRepository extends JpaRepository<ElementFacturableCible, Long> {
    List<ElementFacturableCible> findByElementFacturableIdOrderByTargetIndexAscIdAsc(Long elementFacturableId);

    @EntityGraph(attributePaths = {"vehicule", "remorque"})
    List<ElementFacturableCible> findByElementFacturableAgenceIdAndContratIdAndElementFacturableIdOrderByTargetIndexAscIdAsc(
            Long agenceId, Long contratId, Long elementFacturableId);

    void deleteByElementFacturableId(Long elementFacturableId);
}
