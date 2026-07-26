package com.assurance.dto.response;

import com.assurance.enums.SourceLivraisonAttestation;
import com.assurance.enums.StatutLivraisonAttestation;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Builder
public class LivraisonAttestationResponse {
    private Long id;
    private Long agenceId;
    private Long compagnieAssuranceId;
    private String compagnieAssuranceNom;
    private SourceLivraisonAttestation source;
    private StatutLivraisonAttestation statut;
    private LocalDate dateDemande;
    private LocalDate dateReception;
    private String referenceCommande;
    private String referenceBl;
    private Integer quantiteDemandee;
    private Integer quantiteRecue;
    private Boolean validee;
    private List<LigneView> lignes;
    private List<LotView> lots;

    @Getter
    @Builder
    public static class LigneView {
        private Long id;
        private Long usageId;
        private String usageCode;
        private Long groupeUsageAttestationId;
        private String groupeUsageAttestationCode;
        private String groupeUsageAttestationLibelle;
        private Integer quantiteDemandee;
        private Integer quantiteRecue;
    }

    @Getter
    @Builder
    public static class LotView {
        private Long id;
        private String groupeUsageAttestationCode;
        private String prefixe;
        private String numeroDebut;
        private String numeroFin;
        private Integer quantite;
        private Boolean actif;
    }
}
