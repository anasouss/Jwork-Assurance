package com.assurance.dto.request;

import com.assurance.enums.TypePrestataireSinistre;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpsertPrestataireMedicalRequest extends UpsertExpertSinistreRequest {
    @NotNull
    private TypePrestataireSinistre typePrestataire;
}
