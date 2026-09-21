package com.assurance.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class CreerFactureDepuisReleveRequest {

    @NotEmpty
    private List<Long> elementFacturableIds;

    private LocalDate dateEcheance;

    @Size(max = 1000)
    private String notes;
}
