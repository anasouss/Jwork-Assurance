package com.assurance.repository;

import com.assurance.entity.ElementFacturableCible;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ElementFacturableCibleRepository extends JpaRepository<ElementFacturableCible, Long> {
    List<ElementFacturableCible> findByElementFacturableIdOrderByTargetIndexAscIdAsc(Long elementFacturableId);

    void deleteByElementFacturableId(Long elementFacturableId);
}
