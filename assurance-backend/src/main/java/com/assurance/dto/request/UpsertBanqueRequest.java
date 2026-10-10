package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class UpsertBanqueRequest {
    @NotBlank
    @Size(max = 60)
    private String code;

    @NotBlank
    @Size(max = 160)
    private String libelle;

    @Size(max = 20)
    private List<@NotBlank @Size(max = 160) String> aliases = List.of();

    private Boolean actif;
    private Integer ordre;
}
