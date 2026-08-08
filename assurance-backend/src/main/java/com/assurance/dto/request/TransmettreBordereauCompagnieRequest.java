package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class TransmettreBordereauCompagnieRequest {
    @NotNull
    private LocalDate dateTransmission;
    @NotBlank
    @Size(max = 80)
    private String canalTransmission;
    @Size(max = 160)
    private String referenceTransmission;
}
