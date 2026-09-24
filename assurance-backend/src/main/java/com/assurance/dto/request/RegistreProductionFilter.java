package com.assurance.dto.request;

import com.assurance.enums.CategorieMouvementContrat;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.enums.TypeContrat;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class RegistreProductionFilter {
    private String typeDate;
    private LocalDate dateDu;
    private LocalDate dateAu;
    private Long brancheId;
    private Long compagnieId;
    private CategorieMouvementContrat categorie;
    private TypeContrat typeContrat;
    private StatutMouvementContrat statut;
    private String search;
    private String sortBy;
    private String sortDirection;
}
