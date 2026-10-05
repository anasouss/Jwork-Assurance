package com.assurance.dto.request;

import com.assurance.enums.DecisionCouvertureSinistre;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class UpdateSinistreGarantiesRequest {

    @Valid
    @NotEmpty
    private List<Garantie> garanties;

    @Data
    public static class Garantie {

        @NotNull
        private Long id;

        @NotNull
        private DecisionCouvertureSinistre decisionCouverture;

        private Boolean impliquee;

        @DecimalMin("0")
        private BigDecimal franchiseAppliquee;

        @DecimalMin("0")
        private BigDecimal montantIndemnisable;
    }
}
