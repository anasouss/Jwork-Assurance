package com.assurance.dto.request;

import com.assurance.enums.SensAjustementTarifUsage;
import com.assurance.enums.TypeCalculAjustementTarifUsage;
import com.assurance.enums.TypeOperationTarifUsage;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class BulkUpdateTarifUsageRequest {
    private List<Long> tarifIds;
    private List<Long> usageIds;

    @NotNull
    private TypeOperationTarifUsage typeOperation;

    private TypeCalculAjustementTarifUsage typeCalcul;

    private SensAjustementTarifUsage sens;

    private BigDecimal value;

    @NotNull
    private LocalDate dateDebut;

    private LocalDate dateFin;

    @Size(max = 500)
    private String motif;
}
