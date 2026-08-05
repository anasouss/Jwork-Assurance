package com.assurance.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpsertGarageSinistreRequest {

    @NotBlank
    @Size(max = 40)
    private String code;

    @NotBlank
    @Size(max = 180)
    private String raisonSociale;

    @Size(max = 60)
    private String telephone;

    @Email
    @Size(max = 180)
    private String email;

    @Size(max = 500)
    private String adresse;

    private Long villeId;

    private Boolean actif;
}
