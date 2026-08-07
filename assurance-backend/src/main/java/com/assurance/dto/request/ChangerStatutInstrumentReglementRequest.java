package com.assurance.dto.request;

import com.assurance.enums.StatutInstrumentReglement;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class ChangerStatutInstrumentReglementRequest {
    @NotNull
    private StatutInstrumentReglement statut;
    private Long compteTresorerieId;
    private LocalDate dateOperation;
    @Size(max = 500)
    private String motif;
}
