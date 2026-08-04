package com.assurance.dto.request;

import com.assurance.enums.BaseCalculRegleFiscale;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.ModeCalculRegleFiscale;
import com.assurance.enums.NatureRegleFiscale;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeGarantie;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class UpsertRegleFiscaleRequest {
    @NotBlank @Size(max = 100)
    private String code;
    @NotBlank @Size(max = 180)
    private String libelle;
    @NotNull
    private NatureRegleFiscale nature;
    @NotNull
    private ModeCalculRegleFiscale modeCalcul;
    @NotNull @DecimalMin("0")
    private BigDecimal valeur;
    @NotNull
    private BaseCalculRegleFiscale baseCalcul;
    private CategorieQuittance categorieBase;
    @NotNull
    private CategorieQuittance categorieResultat;
    private Long compagnieAssuranceId;
    private Long categorieClientId;
    private Long garantieId;
    private TypeGarantie typeGarantie;
    private Long usageId;
    private Long groupeUsageAttestationId;
    private TypeContrat typeContrat;
    @NotNull
    private LocalDate dateDebut;
    private LocalDate dateFin;
    private Boolean applicable;
    private Integer priorite;
    private Boolean actif;
    @Size(max = 500)
    private String description;
    @Size(max = 250)
    private String referenceReglementaire;
}
