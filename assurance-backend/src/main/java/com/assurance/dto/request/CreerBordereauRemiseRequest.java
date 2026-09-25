package com.assurance.dto.request;

import com.assurance.enums.TypeBordereauRemise;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class CreerBordereauRemiseRequest {

    @NotNull
    private TypeBordereauRemise type;

    @NotNull
    private LocalDate dateBordereau;

    @NotNull
    private Long compteDestinationId;

    private Long compteSourceId;

    @Positive
    private BigDecimal montantEspeces;

    @Size(max = 120)
    private String referenceBancaire;

    @Size(max = 1000)
    private String notes;

    @Size(max = 200)
    private List<Long> instrumentIds = new ArrayList<>();
}
