package com.assurance.dto.response;

import com.assurance.entity.Permission;
import com.assurance.security.PermissionDependencies;
import lombok.Builder;
import lombok.Data;

import java.util.Set;

@Data
@Builder
public class AdminPermissionResponse {
    private Long id;
    private String code;
    private String nom;
    private String module;
    private String description;
    private Boolean superAdminOnly;
    private Set<String> requiredPermissionCodes;

    public static AdminPermissionResponse from(Permission permission) {
        return AdminPermissionResponse.builder()
                .id(permission.getId())
                .code(permission.getCode())
                .nom(permission.getNom())
                .module(permission.getModule())
                .description(permission.getDescription())
                .superAdminOnly(permission.getSuperAdminOnly())
                .requiredPermissionCodes(PermissionDependencies.requiredFor(permission.getCode()))
                .build();
    }
}
