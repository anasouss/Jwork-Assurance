package com.assurance.dto.response;

import com.assurance.entity.Permission;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AdminPermissionResponse {
    private Long id;
    private String code;
    private String nom;
    private String module;
    private String description;
    private Boolean superAdminOnly;

    public static AdminPermissionResponse from(Permission permission) {
        return AdminPermissionResponse.builder()
                .id(permission.getId())
                .code(permission.getCode())
                .nom(permission.getNom())
                .module(permission.getModule())
                .description(permission.getDescription())
                .superAdminOnly(permission.getSuperAdminOnly())
                .build();
    }
}
