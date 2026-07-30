package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class ClientCrmResponse {
    private ClientResponse client;
    private List<GroupeClientResponse> groupes;
    private List<ContratView> contrats;
    private BigDecimal totalQuittances;
    private BigDecimal totalImpayes;

    @Data
    @Builder
    public static class ContratView {
        private Long id;
        private String numeroDossier;
        private String numeroPolice;
        private String typeContrat;
        private String statut;
        private LocalDate dateEffet;
        private LocalDate dateEcheance;
        private String compagnie;
        private String roleClient;
        private String typePayeurPrime;
        private String payeurPrimeNom;
        private String modeFacturation;
        private BigDecimal primeTotale;
        private List<MouvementView> mouvements;
    }

    @Data
    @Builder
    public static class MouvementView {
        private Long id;
        private String numeroMouvement;
        private String code;
        private String libelle;
        private String categorie;
        private String statut;
        private LocalDate dateEffet;
        private LocalDate dateEcheance;
        private BigDecimal primeTotale;
    }
}
