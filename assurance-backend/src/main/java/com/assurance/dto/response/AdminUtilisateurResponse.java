package com.assurance.dto.response;

import com.assurance.entity.Utilisateur;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Set;

@Data
@Builder
public class AdminUtilisateurResponse {
    private String id;
    private String agenceId;
    private String agenceNom;
    private String roleId;
    private String roleCode;
    private String roleNom;
    private String email;
    private String prenom;
    private String nom;
    private String fullName;
    private String telephone;
    private Boolean actif;
    private LocalDateTime lastLogin;
    private Set<String> permissions;

    public static AdminUtilisateurResponse from(Utilisateur user) {
        return AdminUtilisateurResponse.builder()
                .id(user.getId())
                .agenceId(user.getAgence() != null ? user.getAgence().getId() : null)
                .agenceNom(user.getAgence() != null ? user.getAgence().getNom() : null)
                .roleId(user.getRole() != null ? user.getRole().getId() : null)
                .roleCode(user.getRole() != null ? user.getRole().getCode() : null)
                .roleNom(user.getRole() != null ? user.getRole().getNom() : null)
                .email(user.getEmail())
                .prenom(user.getPrenom())
                .nom(user.getNom())
                .fullName(user.getFullName())
                .telephone(user.getTelephone())
                .actif(user.getActif())
                .lastLogin(user.getLastLogin())
                .permissions(user.getPermissions())
                .build();
    }
}
