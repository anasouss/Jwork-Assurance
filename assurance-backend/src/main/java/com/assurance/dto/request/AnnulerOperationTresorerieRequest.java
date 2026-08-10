package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class AnnulerOperationTresorerieRequest {
    @NotNull
    private LocalDate dateOperation;

    @NotBlank
    @Size(max = 1000)
    private String motif;
}
