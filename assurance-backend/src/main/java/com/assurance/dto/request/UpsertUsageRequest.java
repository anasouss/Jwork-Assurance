package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpsertUsageRequest {
    @NotBlank
    private String code;

    @NotBlank
    private String libelle;

    private String criteria;
    private String groupeUsageAttestationId;
    private Boolean consommeAttestation;
    private Boolean byCarburantAndPf;
    private Boolean bySousClasse;
    private Boolean byPtc;
    private Boolean byPrime;
    private Boolean byCategorieTransport;
    private Boolean garantiesPersonne;
    private Boolean actif;
}
