package com.assurance.dto.response;

import com.assurance.enums.RelationGroupeClient;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class GroupeClientResponse {
    private Long id;
    private String code;
    private String libelle;
    private Long clientTeteId;
    private String clientTeteNom;
    private Long clientTresorerieId;
    private String clientTresorerieNom;
    private Boolean facturationConsolideeDefaut;
    private Boolean actif;
    private List<MembreView> membres;

    @Data
    @Builder
    public static class MembreView {
        private Long membershipId;
        private Long clientId;
        private String clientNom;
        private RelationGroupeClient typeRelation;
        private LocalDate dateDebut;
        private LocalDate dateFin;
        private Boolean principal;
    }
}
