package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "permissions")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Permission extends BaseEntity {

    @Column(nullable = false, unique = true, length = 120)
    private String code;

    @Column(nullable = false, length = 120)
    private String nom;

    @Column(nullable = false, length = 50)
    private String module;

    @Column(length = 255)
    private String description;

    @Builder.Default
    @Column(name = "super_admin_only", nullable = false)
    private Boolean superAdminOnly = false;
}
