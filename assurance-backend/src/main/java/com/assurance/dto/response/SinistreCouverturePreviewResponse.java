package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class SinistreCouverturePreviewResponse {
    private Long contratId;
    private String numeroDossier;
    private String numeroPolice;
    private String compagnie;
    private String assure;
    private Long mouvementId;
    private String numeroMouvement;
    private String mouvement;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;
    private List<Vehicule> vehicules;

    @Data
    @Builder
    public static class Vehicule {
        private Long id;
        private String immatriculation;
        private String numeroAttestation;
        private String marque;
        private String usageCode;
        private String usageLibelle;
        private List<Garantie> garanties;
    }

    @Data
    @Builder
    public static class Garantie {
        private Long id;
        private Long mouvementGarantieId;
        private String code;
        private String libelle;
        private BigDecimal capital;
        private BigDecimal prime;
        private BigDecimal taux;
        private BigDecimal tauxFranchise;
        private BigDecimal franchiseMinimale;
    }
}
