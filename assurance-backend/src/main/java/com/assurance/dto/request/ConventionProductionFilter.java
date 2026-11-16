package com.assurance.dto.request;

import com.assurance.enums.ModeReglementConvention;
import com.assurance.enums.CategorieMouvementContrat;
import com.assurance.enums.SensPrimeConvention;
import lombok.Getter;
import lombok.Setter;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDate;

@Getter
@Setter
public class ConventionProductionFilter {
    private Long conventionId;
    private java.util.List<Long> conventionIds;
    private Long compagnieId;
    private ModeReglementConvention mode;
    private CategorieMouvementContrat categorieMouvement;
    private java.util.List<CategorieMouvementContrat> categoriesMouvement;
    private SensPrimeConvention sensPrime;
    private com.assurance.enums.StatutProductionConvention statut;
    private String typeDate = "EFFET";
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate dateDu;
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate dateAu;

    public java.util.List<Long> selectedConventionIds() {
        var selected = new java.util.LinkedHashSet<Long>();
        if (conventionId != null) selected.add(conventionId);
        if (conventionIds != null) {
            if (conventionIds.stream().anyMatch(java.util.Objects::isNull)) throw new com.assurance.exception.BadRequestException("Convention invalide");
            selected.addAll(conventionIds);
        }
        return java.util.List.copyOf(selected);
    }

    public java.util.List<CategorieMouvementContrat> selectedMovementCategories() {
        var selected = new java.util.LinkedHashSet<CategorieMouvementContrat>();
        if (categorieMouvement != null) selected.add(categorieMouvement);
        if (categoriesMouvement != null) {
            if (categoriesMouvement.stream().anyMatch(java.util.Objects::isNull)) throw new com.assurance.exception.BadRequestException("Mouvement invalide");
            selected.addAll(categoriesMouvement);
        }
        return java.util.List.copyOf(selected);
    }
}
