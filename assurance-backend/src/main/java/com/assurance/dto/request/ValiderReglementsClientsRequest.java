package com.assurance.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class ValiderReglementsClientsRequest {

    @NotEmpty(message = "Sélectionnez au moins un règlement")
    @Size(max = 100, message = "Vous ne pouvez pas valider plus de 100 règlements à la fois")
    private List<@NotNull Long> reglementIds = new ArrayList<>();
}
