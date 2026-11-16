package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class RectifierFactureConventionRequest {
    @NotEmpty
    private List<@NotNull Long> echeanceIds;

    @NotNull
    private java.math.BigDecimal montantAttendu;

    @NotBlank
    @Size(max = 500)
    private String motif;

    @Size(max = 1000)
    private String notes;

    private LocalDate dateEcheance;
}
