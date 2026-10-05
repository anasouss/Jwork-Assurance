package com.assurance.repository;

import com.assurance.entity.SinistreGarantie;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SinistreGarantieRepository extends JpaRepository<SinistreGarantie, Long> {

    @Query("""
            select sg
            from SinistreGarantie sg
            join fetch sg.garantie g
            left join fetch sg.mouvementGarantieSource
            where sg.sinistre.id = :sinistreId
            order by
                case when g.ordreAffichage is null then 1 else 0 end,
                g.ordreAffichage,
                lower(sg.snapshotCode),
                sg.id
            """)
    List<SinistreGarantie> findForDetailOrderByConfiguredDisplay(
            @Param("sinistreId") Long sinistreId
    );

    Optional<SinistreGarantie> findByIdAndSinistreId(Long id, Long sinistreId);

    void deleteBySinistreId(Long sinistreId);
}
