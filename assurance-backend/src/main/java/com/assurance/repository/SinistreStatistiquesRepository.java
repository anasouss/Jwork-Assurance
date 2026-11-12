package com.assurance.repository;

import com.assurance.entity.Sinistre;
import com.assurance.enums.EtapeSuiviSinistre;
import com.assurance.enums.StatutSinistre;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface SinistreStatistiquesRepository extends Repository<Sinistre, Long> {

    String COHORT = """
            s.agence.id = :agenceId
            and s.dateDeclaration between :dateDu and :dateAu
            and s.statut not in (com.assurance.enums.StatutSinistre.BROUILLON,
                                 com.assurance.enums.StatutSinistre.ANNULE)
            """;

    @Query("""
            select s.statut as statut, s.etapeSuivi as etape, count(s) as nombre,
                   sum(case when s.dateEcheanceAction < :aujourdhui then 1 else 0 end) as enRetard
            from Sinistre s where
            """ + COHORT + " group by s.statut, s.etapeSuivi")
    List<Etat> etats(@Param("agenceId") Long agenceId, @Param("dateDu") LocalDate dateDu,
                    @Param("dateAu") LocalDate dateAu, @Param("aujourdhui") LocalDate aujourdhui);

    @Query("select month(s.dateDeclaration) as mois, count(s) as nombre from Sinistre s where "
            + COHORT + " group by month(s.dateDeclaration) order by month(s.dateDeclaration)")
    List<Mensuel> mensuels(@Param("agenceId") Long agenceId, @Param("dateDu") LocalDate dateDu,
                          @Param("dateAu") LocalDate dateAu);

    @Query("""
            select b.id as id, b.libelle as libelle, count(s) as nombre
            from Sinistre s left join s.contrat.brancheAssurance b where
            """ + COHORT + " group by b.id, b.libelle order by count(s) desc, b.libelle")
    List<Groupe> branches(@Param("agenceId") Long agenceId, @Param("dateDu") LocalDate dateDu,
                         @Param("dateAu") LocalDate dateAu);

    @Query("""
            select c.id as id, c.nom as libelle, count(s) as nombre
            from Sinistre s join s.compagnieAssurance c where
            """ + COHORT + " group by c.id, c.nom order by count(s) desc, c.nom")
    List<Groupe> compagnies(@Param("agenceId") Long agenceId, @Param("dateDu") LocalDate dateDu,
                           @Param("dateAu") LocalDate dateAu);

    @Query("""
            select s.dateDeclaration as declaration, s.dateCloture as cloture
            from Sinistre s where
            """ + COHORT + """
             and s.statut = com.assurance.enums.StatutSinistre.CLOTURE
             and s.dateCloture >= s.dateDeclaration
            """)
    List<Delai> delais(@Param("agenceId") Long agenceId, @Param("dateDu") LocalDate dateDu,
                      @Param("dateAu") LocalDate dateAu);

    @Query("""
            select s.compagnieAssurance.id as compagnieId,
                sum(case when o.type = com.assurance.enums.TypeOperationSinistre.REGLEMENT then o.montant else 0 end) as reglements,
                sum(case when o.type = com.assurance.enums.TypeOperationSinistre.RECOURS then o.montant else 0 end) as recours,
                sum(case when o.type = com.assurance.enums.TypeOperationSinistre.FRAIS then o.montant else 0 end) as frais
            from SinistreOperation o join o.sinistre s where
            """ + COHORT + """
             and o.type <> com.assurance.enums.TypeOperationSinistre.ANNULATION
             and not exists (select a.id from SinistreOperation a where a.operationAnnulee = o)
             group by s.compagnieAssurance.id
            """)
    List<Finances> finances(@Param("agenceId") Long agenceId, @Param("dateDu") LocalDate dateDu,
                           @Param("dateAu") LocalDate dateAu);

    @Query("""
            select s.compagnieAssurance.id as compagnieId, sum(p.montant) as montant
            from ProvisionSinistre p join p.sinistre s where
            """ + COHORT + """
             and s.statut in :ouverts
             and not exists (select n.id from ProvisionSinistre n where n.sinistre = s and
                 (n.dateProvision > p.dateProvision
                  or (n.dateProvision = p.dateProvision and n.createdAt > p.createdAt)
                  or (n.dateProvision = p.dateProvision and n.createdAt = p.createdAt and n.id > p.id)))
             group by s.compagnieAssurance.id
            """)
    List<Provisions> provisions(@Param("agenceId") Long agenceId, @Param("dateDu") LocalDate dateDu,
                               @Param("dateAu") LocalDate dateAu, @Param("ouverts") Collection<StatutSinistre> ouverts);

    @Query("""
            select distinct year(s.dateDeclaration) from Sinistre s
            where s.agence.id = :agenceId
              and s.statut not in (com.assurance.enums.StatutSinistre.BROUILLON,
                                   com.assurance.enums.StatutSinistre.ANNULE)
            order by year(s.dateDeclaration) desc
            """)
    List<Integer> annees(@Param("agenceId") Long agenceId);

    interface Etat {
        StatutSinistre getStatut();
        EtapeSuiviSinistre getEtape();
        long getNombre();
        long getEnRetard();
    }

    interface Mensuel {
        int getMois();
        long getNombre();
    }

    interface Groupe {
        Long getId();
        String getLibelle();
        long getNombre();
    }

    interface Delai {
        LocalDate getDeclaration();
        LocalDate getCloture();
    }

    interface Finances {
        Long getCompagnieId();
        BigDecimal getReglements();
        BigDecimal getRecours();
        BigDecimal getFrais();
    }

    interface Provisions {
        Long getCompagnieId();
        BigDecimal getMontant();
    }
}
