package com.assurance.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class AvenantRequest {

    @NotBlank
    private String codeTypeMouvement;

    private String numeroMouvement;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;
    private String notes;

    private List<Long> vehiculeIds;
    private List<Long> remorqueIds;

    @Valid
    private List<TargetPrecision> precisions;

    @Valid
    private List<CreateContratRequest.VehiculeInput> vehicules;

    @Valid
    private List<CreateContratRequest.RemorqueInput> remorques;

    @Valid
    private List<CreateContratRequest.GarantieInput> garanties;

    @Data
    public static class TargetPrecision {
        private Long vehiculeId;
        private Long remorqueId;
        private String immatriculation;
        private String immatriculationProvisoire;
        private String numeroAttestation;
    }
}
