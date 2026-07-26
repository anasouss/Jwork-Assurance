package com.assurance.dto.request;

import lombok.Data;

import java.util.List;

@Data
public class ConvertirProspectionRequest {
    private String numeroPolice;
    private List<AttestationVehicule> vehicules;
    private List<AttestationRemorque> remorques;
    private List<Assistance> assistances;

    @Data
    public static class AttestationVehicule {
        private Long vehiculeId;
        private String numeroAttestation;
    }

    @Data
    public static class AttestationRemorque {
        private Long remorqueId;
        private String numeroAttestation;
    }

    @Data
    public static class Assistance {
        private Long assistanceId;
        private String numeroContratOuQuittance;
    }
}
