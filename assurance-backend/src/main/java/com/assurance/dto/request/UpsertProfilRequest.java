package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Set;

@Data
public class UpsertProfilRequest {
    private String agenceId;

    @NotBlank
    private String code;

    @NotBlank
    private String nom;

    private String description;
    private Boolean profilSysteme = false;
    private Set<String> permissionIds = Set.of();
}
