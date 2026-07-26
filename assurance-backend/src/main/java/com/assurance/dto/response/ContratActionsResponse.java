package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ContratActionsResponse {
    private Long contratId;
    private Boolean renouvelable;
    private Boolean avenantsAutorises;
    private Boolean carteVerteAutorisee;
    private Boolean assistanceAutorisee;
    private List<MouvementDisponible> mouvementsDisponibles;

    @Data
    @Builder
    public static class MouvementDisponible {
        private String code;
        private String libelle;
        private String categorie;
        private String typeImpact;
        private Boolean modifieGaranties;
        private Boolean garantiesEditables;
        private Boolean modifieVehicule;
        private Boolean modifieRemorque;
        private Boolean cnpacSeul;
        private Boolean genereQuittance;
        private Boolean autoriseAssistance;
        private Boolean autoriseCarteVerte;
        private Boolean consommeAttestation;
        private Boolean clotureContrat;
        private Boolean renouvelleContrat;
    }
}
