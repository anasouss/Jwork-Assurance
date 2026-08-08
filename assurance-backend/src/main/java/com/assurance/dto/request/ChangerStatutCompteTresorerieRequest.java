package com.assurance.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ChangerStatutCompteTresorerieRequest {

    @NotNull
    private Boolean actif;
}
