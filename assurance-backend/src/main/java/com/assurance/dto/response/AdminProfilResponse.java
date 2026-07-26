package com.assurance.dto.response;

import com.assurance.entity.Permission;
import com.assurance.entity.Profil;
import lombok.Builder;
import lombok.Data;

import java.util.Set;
import java.util.stream.Collectors;

@Data
@Builder
public class AdminProfilResponse {
    private String id;
    private String agenceId;
    private String agenceNom;
    private String code;
    private String nom;
    private String description;
    private Boolean profilSysteme;
    private Set<String> permissionIds;
    private Set<String> permissionCodes;

    public static AdminProfilResponse from(Profil profil) {
        return AdminProfilResponse.builder()
                .id(profil.getId())
                .agenceId(profil.getAgence() != null ? profil.getAgence().getId() : null)
                .agenceNom(profil.getAgence() != null ? profil.getAgence().getNom() : "Global")
                .code(profil.getCode())
                .nom(profil.getNom())
                .description(profil.getDescription())
                .profilSysteme(profil.getProfilSysteme())
                .permissionIds(profil.getPermissions().stream().map(Permission::getId).collect(Collectors.toSet()))
                .permissionCodes(profil.getPermissionCodes())
                .build();
    }
}
