package com.assurance.dto.response;

import com.assurance.entity.Permission;
import com.assurance.security.PermissionDependencies;
import com.assurance.security.PermissionCatalog;
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
    private String resource;
    private String resourceLabel;
    private String action;
    private String actionLabel;
    private Boolean sensitive;
    private Boolean assignable;

    public static AdminPermissionResponse from(Permission permission) {
        PermissionCatalog.Definition definition = PermissionCatalog.find(permission.getCode());
        return AdminPermissionResponse.builder()
                .id(permission.getId())
                .code(permission.getCode())
                .nom(permission.getNom())
                .module(permission.getModule())
                .description(permission.getDescription())
                .superAdminOnly(permission.getSuperAdminOnly())
                .requiredPermissionCodes(PermissionDependencies.requiredFor(permission.getCode()))
                .resource(definition == null ? permission.getCode().split(":", 2)[0] : definition.resource())
                .resourceLabel(definition == null ? null : definition.resourceLabel())
                .action(definition == null ? null : definition.action())
                .actionLabel(definition == null ? null : definition.actionLabel())
                .sensitive(definition != null && definition.sensitive())
                .build();
    }
}
