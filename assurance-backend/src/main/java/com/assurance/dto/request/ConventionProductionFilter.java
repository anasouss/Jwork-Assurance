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
    private Long compagnieId;
    private ModeReglementConvention mode;
    private CategorieMouvementContrat categorieMouvement;
    private SensPrimeConvention sensPrime;
    private String typeDate = "EFFET";
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate dateDu;
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate dateAu;
}
