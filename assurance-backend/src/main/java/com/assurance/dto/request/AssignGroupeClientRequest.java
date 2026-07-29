package com.assurance.dto.request;

import com.assurance.enums.RelationGroupeClient;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class AssignGroupeClientRequest {
    @NotNull
    private Long groupeClientId;

    @NotNull
    private RelationGroupeClient typeRelation;

    private LocalDate dateDebut;
    private Boolean principal;
}
