package com.assurance.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class UpdateUsageTauxExtensionRemorqueRequest {

    @Valid
    @NotEmpty
    private List<Ligne> lignes;

    @Data
    public static class Ligne {
        @NotNull
        private Long usageId;

        @NotNull
        @DecimalMin("0")
        @DecimalMax("100")
        private BigDecimal taux;
    }
}
