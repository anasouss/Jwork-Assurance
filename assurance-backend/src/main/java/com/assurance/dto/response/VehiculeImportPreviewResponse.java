package com.assurance.dto.response;

import com.assurance.dto.request.CreateContratRequest;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class VehiculeImportPreviewResponse {
    private int totalLignes;
    private int lignesValides;
    private int lignesEnErreur;
    private List<Ligne> lignes;

    @Data
    @Builder
    public static class Ligne {
        private int numeroLigne;
        private String immatriculation;
        private String numeroAttestation;
        private String usage;
        private String marque;
        private CreateContratRequest.VehiculeInput vehicule;
        private List<String> erreurs;
        private List<String> avertissements;
    }
}
