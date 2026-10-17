package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class RepresenterInstrumentReglementRequest {

    @NotNull
    private LocalDate dateRepresentation;

    @NotBlank
    @Size(max = 500)
    private String motif;
}
