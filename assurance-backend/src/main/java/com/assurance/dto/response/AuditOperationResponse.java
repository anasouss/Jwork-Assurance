package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AuditOperationResponse {
    private String key;
    private List<AuditEventResponse> events;
}
