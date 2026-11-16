package com.assurance.dto.request;

import com.assurance.enums.TypePrestataireSinistre;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.util.Set;

@Data
public class UpsertDomaineInterventionRequest {
    @NotBlank
    @Size(max = 40)
    private String code;

    @NotBlank
    @Size(max = 180)
    private String libelle;

    @NotNull
    private Long brancheId;

    @NotEmpty
    private Set<@NotNull TypePrestataireSinistre> operateurs;

    private boolean actif = true;
}
