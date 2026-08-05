package com.assurance.dto.request;

import com.assurance.enums.TypePartieSinistre;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AddSinistrePartieRequest {

    @NotNull
    private TypePartieSinistre type;

    @NotBlank
    @Size(max = 180)
    private String nom;

    @Size(max = 60)
    private String telephone;

    @Size(max = 100)
    private String cin;

    @Size(max = 100)
    private String numeroPermis;

    @Size(max = 100)
    private String immatriculation;

    @Size(max = 180)
    private String compagnieAdverse;

    @Size(max = 100)
    private String numeroPoliceAdverse;

    @Size(max = 1000)
    private String notes;
}
