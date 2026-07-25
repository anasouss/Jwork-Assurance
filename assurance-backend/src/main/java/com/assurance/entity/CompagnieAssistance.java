package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "compagnies_assistance", indexes = {
        @Index(name = "idx_compagnie_assistance_code", columnList = "code")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompagnieAssistance extends BaseEntity {

    @Column(nullable = false, unique = true, length = 80)
    private String code;

    @Column(nullable = false, length = 160)
    private String nom;

    @Column(length = 150)
    private String email;

    @Column(length = 60)
    private String telephone;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
