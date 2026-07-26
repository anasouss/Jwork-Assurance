package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.Set;

@Entity
@Table(name = "users", indexes = {
        @Index(name = "idx_user_agence", columnList = "agence_id"),
        @Index(name = "idx_user_role", columnList = "role_id"),
        @Index(name = "idx_user_actif", columnList = "actif")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Utilisateur extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id")
    private Agence agence;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @Column(nullable = false, unique = true, length = 180)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(name = "prenom", nullable = false, length = 100)
    private String prenom;

    @Column(name = "nom", nullable = false, length = 100)
    private String nom;

    @Column(length = 50)
    private String telephone;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;

    @Column(name = "last_login")
    private LocalDateTime lastLogin;

    public String getFullName() {
        return prenom + " " + nom;
    }

    public String getRoleCode() {
        return role == null ? null : role.getCode();
    }

    public Set<String> getPermissions() {
        return role == null ? Set.of() : role.getPermissionCodes();
    }
}
