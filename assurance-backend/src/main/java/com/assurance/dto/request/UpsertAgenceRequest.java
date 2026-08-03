package com.assurance.dto.request;

import com.assurance.enums.StatutAgence;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class UpsertAgenceRequest {
    @NotBlank
    private String code;

    @NotBlank
    private String nom;

    private String adresse;
    private String ville;
    private String telephone;
    private String fax;

    @Email
    private String email;
    private String identifiantFiscal;
    private String patente;
    private String ice;
    private String numeroAgrement;
    private LocalDate dateAgrement;
    private String banque;
    private String rib;

    @NotNull
    private StatutAgence statut = StatutAgence.ACTIVE;
}
