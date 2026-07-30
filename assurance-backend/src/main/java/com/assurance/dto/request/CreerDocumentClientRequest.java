package com.assurance.dto.request;

import com.assurance.enums.TypeDocumentClient;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class CreerDocumentClientRequest {

    @NotNull
    private TypeDocumentClient typeDocument;

    @NotEmpty
    private List<Long> quittanceIds;

    @NotNull
    private LocalDate periodeDebut;

    @NotNull
    private LocalDate periodeFin;

    private LocalDate dateEcheance;

    @Size(max = 1000)
    private String notes;
}
