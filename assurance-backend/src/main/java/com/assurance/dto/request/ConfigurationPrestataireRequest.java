package com.assurance.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class ConfigurationPrestataireRequest {
    private Boolean toutesCompagnies;

    @Size(max = 100)
    private List<@NotNull Long> domaineIds;

    @Size(max = 100)
    private List<@NotNull Long> specialiteIds;

    @Valid
    @Size(max = 100)
    private List<@NotNull Accord> accords;

    @Data
    public static class Accord {
        @NotNull
        private Long compagnieId;

        private boolean actif = true;
        private boolean conventionne;

        private Boolean tousUsages;

        @Size(max = 500)
        private List<@NotNull Long> usageIds;

        private LocalDate dateDebut;
        private LocalDate dateFin;
    }
}
