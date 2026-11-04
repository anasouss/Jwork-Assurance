package com.assurance.dto.response;

import com.assurance.enums.TypeClient;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;

@Data
@Builder
public class DocumentOwnerOptionResponse {
    private Long id;
    private String libelle;
    private TypeClient typeClient;
    private LocalDate cinValidite;
    private LocalDate passportValidite;
    private LocalDate dateValiditePermis;
    private LocalDate dateExpirationCarteGrise;
}
