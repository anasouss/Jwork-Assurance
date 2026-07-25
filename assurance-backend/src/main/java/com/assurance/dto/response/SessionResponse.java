package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SessionResponse {
    private String id;
    private String deviceName;
    private String deviceType;
    private String ipAddress;
    private boolean current;
    private LocalDateTime lastActivityAt;
    private LocalDateTime createdAt;
}
