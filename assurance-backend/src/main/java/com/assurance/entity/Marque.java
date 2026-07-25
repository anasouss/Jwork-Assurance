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
@Table(name = "marques")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Marque extends BaseEntity {

    @Column(nullable = false, unique = true, length = 120)
    private String libelle;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
