package com.assurance.dto.response;

import com.assurance.entity.Permission;
import com.assurance.entity.Role;
import lombok.Builder;
import lombok.Data;

import java.util.Set;
import java.util.stream.Collectors;

@Data
@Builder
public class AdminRoleResponse {
    private Long id;
    private Long agenceId;
    private String agenceNom;
    private String code;
    private String nom;
    private String description;
    private Boolean systemRole;
    private Set<Long> permissionIds;
    private Set<String> permissionCodes;

    public static AdminRoleResponse from(Role role) {
        return AdminRoleResponse.builder()
                .id(role.getId())
                .agenceId(role.getAgence() != null ? role.getAgence().getId() : null)
                .agenceNom(role.getAgence() != null ? role.getAgence().getNom() : "Global")
                .code(role.getCode())
                .nom(role.getNom())
                .description(role.getDescription())
                .systemRole(role.getSystemRole())
                .permissionIds(role.getPermissions().stream().map(Permission::getId).collect(Collectors.toSet()))
                .permissionCodes(role.getPermissionCodes())
                .build();
    }
}
