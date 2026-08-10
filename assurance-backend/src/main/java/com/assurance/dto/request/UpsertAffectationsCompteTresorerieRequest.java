package com.assurance.dto.request;

import com.assurance.enums.NiveauAccesCompteTresorerie;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class UpsertAffectationsCompteTresorerieRequest {

    @Valid
    @NotNull
    private List<Ligne> affectations = new ArrayList<>();

    @Getter
    @Setter
    public static class Ligne {
        @NotNull
        private Long utilisateurId;

        @NotNull
        private NiveauAccesCompteTresorerie niveauAcces;

        @NotNull
        private Boolean actif;
    }
}
