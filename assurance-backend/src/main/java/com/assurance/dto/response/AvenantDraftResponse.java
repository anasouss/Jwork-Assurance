package com.assurance.dto.response;

import com.assurance.dto.request.AvenantRequest;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AvenantDraftResponse {
    private Long id;
    private Long contratId;
    private String codeTypeMouvement;
    private LocalDateTime updatedAt;
    private AvenantRequest request;
}
