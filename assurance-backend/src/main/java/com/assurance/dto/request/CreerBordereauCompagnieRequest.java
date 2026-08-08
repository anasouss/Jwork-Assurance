package com.assurance.dto.request;

import com.assurance.enums.BaseBordereauCompagnie;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class CreerBordereauCompagnieRequest {
    @NotNull
    private Long compagnieId;
    @NotNull
    private BaseBordereauCompagnie baseBordereau;
    @NotNull
    private LocalDate periodeDebut;
    @NotNull
    private LocalDate periodeFin;
    @Size(max = 1000)
    private String notes;
    @NotEmpty
    private List<Long> affectationIds;
}
