package com.assurance.dto.response;

import com.assurance.enums.StatutSinistre;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;

@Getter
@Builder
public class SinistreDoublonResponse {
    private Long id;
    private String numeroSinistre;
    private StatutSinistre statut;
    private LocalDate dateSinistre;
}
