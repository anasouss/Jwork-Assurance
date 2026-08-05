package com.assurance.dto.request;

import com.assurance.enums.DecisionCouvertureSinistre;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdateSinistreGarantieRequest {

    @NotNull
    private DecisionCouvertureSinistre decisionCouverture;

    private Boolean impliquee;

    @DecimalMin("0")
    private BigDecimal franchiseAppliquee;

    @DecimalMin("0")
    private BigDecimal montantIndemnisable;
}
