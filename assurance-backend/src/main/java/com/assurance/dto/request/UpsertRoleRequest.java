package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Set;

@Data
public class UpsertRoleRequest {
    private Long agenceId;

    @NotBlank
    private String code;

    @NotBlank
    private String nom;

    private String description;
    private Boolean systemRole = false;
    private Set<Long> permissionIds = Set.of();
}
