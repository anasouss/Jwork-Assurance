package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class BanqueResponse {
    private Long id;
    private String code;
    private String libelle;
    private List<String> aliases;
    private Boolean actif;
    private Integer ordre;
}
