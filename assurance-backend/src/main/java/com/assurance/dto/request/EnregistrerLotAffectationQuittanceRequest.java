package com.assurance.dto.request;

import com.assurance.enums.SourceAffectationQuittance;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class EnregistrerLotAffectationQuittanceRequest {
    @NotEmpty
    private List<Long> quittanceIds = new ArrayList<>();
    @NotNull
    private SourceAffectationQuittance source;
    @NotNull
    private Boolean avecRetenue;
    private String fichierSource;
    @Valid
    @NotEmpty
    private List<EnregistrerAffectationQuittanceRequest.Ligne> lignes = new ArrayList<>();
}
