package com.assurance.dto.response;

import com.assurance.enums.ServiceContactCompagnie;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class ContactCompagnieResponse {
    private Long id;
    private Long compagnieAssuranceId;
    private String compagnieAssuranceCode;
    private String compagnieAssuranceNom;
    private String nom;
    private String prenom;
    private ServiceContactCompagnie service;
    private String fonction;
    private String email;
    private String telephoneMobile;
    private String telephoneFixe;
    private String posteTelephonique;
    private Boolean whatsapp;
    private String fax;
    private Boolean principal;
    private String notes;
    private Boolean actif;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
