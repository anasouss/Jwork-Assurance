package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AssistanceDraftResponse {
    private Long contratId;
    private String numeroDossier;
    private String sectionEnregistree;
    private List<Long> clientIds;
}
