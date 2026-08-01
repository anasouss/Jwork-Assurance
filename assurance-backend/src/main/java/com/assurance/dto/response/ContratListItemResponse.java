package com.assurance.dto.response;

import com.assurance.enums.ModeTermeRenouvellement;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.TypeContrat;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class ContratListItemResponse {
    private Long id;
    private String numeroContrat;
    private String numeroDevis;
    private String numeroDossier;
    private String numeroPolice;
    private LocalDateTime createdAt;
    private TypeContrat typeContrat;
    private StatutContrat statut;
    private Long compagnieAssuranceId;
    private String compagnieCode;
    private String compagnieLibelle;
    private Long conventionId;
    private String conventionCode;
    private String conventionLibelle;
    private Long contratOrigineId;
    private Boolean renouvele;
    private ModeTermeRenouvellement modeTermeRenouvellement;
    private Boolean renouvellementTermeCompagnieEligible;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;
    private String typeRenouvellement;
    private Boolean brouillon;
    private Boolean prospection;
    private String premierTypeVehicule;
    private List<ClientLink> clients;
    private List<MovementSummary> mouvements;
    private List<AvenantDraftSummaryResponse> avenantDrafts;

    @Data
    @Builder
    public static class ClientLink {
        private Long clientId;
        private String codeClient;
        private String nomAffichage;
        private String role;
        private boolean principalPourRole;
    }

    @Data
    @Builder
    public static class MovementSummary {
        private Long id;
        private String code;
        private String libelle;
        private String categorie;
        private String statut;
        private String numeroMouvement;
        private LocalDate dateEffet;
        private LocalDate dateEcheance;
        private BigDecimal primeNette;
        private BigDecimal taxe;
        private BigDecimal taxeParafiscale;
        private BigDecimal accessoire;
        private BigDecimal cnpac;
        private BigDecimal primeTotale;
    }
}
