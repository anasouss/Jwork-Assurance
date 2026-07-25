package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Entity
@Table(name = "profils",
        uniqueConstraints = @UniqueConstraint(name = "uk_profil_agence_code", columnNames = {"agence_id", "code"}),
        indexes = @Index(name = "idx_profil_agence", columnList = "agence_id"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Profil extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id")
    private Agence agence;

    @Column(nullable = false, length = 60)
    private String code;

    @Column(nullable = false, length = 120)
    private String nom;

    @Column(length = 255)
    private String description;

    @Builder.Default
    @Column(name = "profil_systeme", nullable = false)
    private Boolean profilSysteme = false;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "profil_permissions",
            joinColumns = @JoinColumn(name = "profil_id"),
            inverseJoinColumns = @JoinColumn(name = "permission_id")
    )
    @Builder.Default
    private Set<Permission> permissions = new HashSet<>();

    public boolean hasPermission(String code) {
        return permissions.stream().anyMatch(permission -> permission.getCode().equals(code));
    }

    public Set<String> getPermissionCodes() {
        return permissions.stream().map(Permission::getCode).collect(Collectors.toSet());
    }
}
