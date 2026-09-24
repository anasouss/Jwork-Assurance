package com.assurance.dto.response;

import com.assurance.enums.CategorieMouvementContrat;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.enums.TypeContrat;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class RegistreProductionResponse {
    private List<Ligne> items;
    private PageMetadata page;
    private Totaux totaux;

    @Data
    @Builder
    public static class Ligne {
        private Long mouvementId;
        private Long contratId;
        private String numeroDossier;
        private String numeroPolice;
        private String numeroMouvement;
        private String mouvementCode;
        private String mouvementLibelle;
        private CategorieMouvementContrat categorie;
        private StatutMouvementContrat statut;
        private TypeContrat typeContrat;
        private LocalDate dateEffet;
        private LocalDate dateValidation;
        private String souscripteur;
        private String assure;
        private String branche;
        private String compagnie;
        private BigDecimal primeNette;
        private BigDecimal taxesEtFrais;
        private BigDecimal primeTotale;
        private BigDecimal assistanceTtc;
    }

    @Data
    @Builder
    public static class Totaux {
        private long mouvements;
        private long annules;
        private long affairesNouvelles;
        private long avenants;
        private long renouvellements;
        private BigDecimal primeNette;
        private BigDecimal taxesEtFrais;
        private BigDecimal primeTotale;
        private BigDecimal assistanceTtc;
    }
}
