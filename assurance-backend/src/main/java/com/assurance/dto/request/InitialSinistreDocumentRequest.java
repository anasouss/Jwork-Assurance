package com.assurance.dto.request;

import com.assurance.enums.TypeDocumentSinistre;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class InitialSinistreDocumentRequest {
    @NotNull
    private TypeDocumentSinistre type;

    private LocalDate dateDocument;

    @Size(max = 120)
    private String reference;

    @DecimalMin("0")
    private BigDecimal montant;

    @Size(max = 180)
    private String emetteur;

    @Size(max = 500)
    private String commentaire;
}
