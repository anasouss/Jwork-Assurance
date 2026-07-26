package com.assurance.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpsertSeuilStockAttestationRequest {
    @NotNull
    private Long compagnieAssuranceId;

    @NotNull
    private Long groupeUsageAttestationId;

    @NotNull
    @Min(0)
    private Integer minimumStock;
}
