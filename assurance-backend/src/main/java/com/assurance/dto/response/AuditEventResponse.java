package com.assurance.dto.response;

import com.assurance.enums.AuditAction;
import com.assurance.enums.AuditActorType;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AuditEventResponse {
    private Long id;
    private Long agenceId;
    private Long actorUserId;
    private String actorName;
    private AuditActorType actorType;
    private String entityType;
    private String entityId;
    private AuditAction action;
    private LocalDateTime occurredAt;
    private JsonNode beforeData;
    private JsonNode afterData;
    private String requestId;
    private String source;
}
