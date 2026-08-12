package com.assurance.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class EnregistrerRapprochementsBancairesRequest {

    @Valid
    private List<Selection> selections = new ArrayList<>();

    private List<Long> lignesIgnorees = new ArrayList<>();

    @Getter
    @Setter
    public static class Selection {
        @NotNull
        private Long ligneId;

        @NotNull
        private Long instrumentId;

        @NotNull
        @DecimalMin(value = "0.01")
        private BigDecimal montant;
    }
}
