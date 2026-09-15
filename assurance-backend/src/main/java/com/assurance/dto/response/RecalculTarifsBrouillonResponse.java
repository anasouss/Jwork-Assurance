package com.assurance.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecalculTarifsBrouillonResponse {

    private Long contratId;
    private boolean applicable;
    private boolean recalculNecessaire;
    private int nombreGarantiesModifiees;
    @Builder.Default
    private List<String> blocages = new ArrayList<>();
    private QuittanceResponse avant;
    private QuittanceResponse apres;
}
