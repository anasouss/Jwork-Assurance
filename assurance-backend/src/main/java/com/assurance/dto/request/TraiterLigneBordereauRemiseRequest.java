package com.assurance.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class TraiterLigneBordereauRemiseRequest {

    @NotNull
    private LocalDate dateOperation;

    @Size(max = 500)
    private String motif;
}
