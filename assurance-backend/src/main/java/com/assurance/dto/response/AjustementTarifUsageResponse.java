package com.assurance.dto.response;

import com.assurance.enums.SensAjustementTarifUsage;
import com.assurance.enums.TypeCalculAjustementTarifUsage;
import com.assurance.enums.TypeOperationTarifUsage;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class AjustementTarifUsageResponse {
    private Long id;
    private TypeOperationTarifUsage typeOperation;
    private TypeCalculAjustementTarifUsage typeCalcul;
    private SensAjustementTarifUsage sens;
    private BigDecimal valeur;
    private LocalDate dateDebut;
    private LocalDate dateFin;
    private String motif;
    private Long createdByUserId;
    private String createdByName;
    private LocalDateTime createdAt;
    private int nombreTarifs;
    private List<Ligne> lignes;

    @Data
    @Builder
    public static class Ligne {
        private Long tarifUsageId;
        private String usageCode;
        private String description;
        private BigDecimal primeNetteInitiale;
        private BigDecimal primeNetteAppliquee;
    }
}
