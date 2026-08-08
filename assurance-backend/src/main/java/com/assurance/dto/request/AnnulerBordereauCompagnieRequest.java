package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AnnulerBordereauCompagnieRequest {
    @NotBlank
    @Size(max = 500)
    private String motif;
}
