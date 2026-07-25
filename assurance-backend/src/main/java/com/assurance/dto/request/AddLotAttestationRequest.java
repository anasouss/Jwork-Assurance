package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AddLotAttestationRequest {

    private String usageId;

    private String groupeUsageAttestationId;

    private String groupeUsageAttestationCode;

    private Integer quantite;

    @NotBlank
    private String numeroDebut;

    @NotBlank
    private String numeroFin;
}
