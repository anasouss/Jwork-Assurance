package com.assurance.dto.response;

import com.assurance.enums.TypeOrigineCommerciale;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class AcquisitionClientResponse {
    private Long id;
    private Long origineCommercialeId;
    private String origineCode;
    private String origineLibelle;
    private TypeOrigineCommerciale origineType;
    private Long recommandeParUtilisateurId;
    private String recommandeParUtilisateurNom;
    private Long recommandeParClientId;
    private String recommandeParClientNom;
    private LocalDate dateAcquisition;
    private String notes;
    private Long saisiParId;
    private String saisiParNom;
    private Long modifieParId;
    private String modifieParNom;
}
