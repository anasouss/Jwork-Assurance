package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ContratListGroupResponse {
    private String key;
    private List<ContratListItemResponse> contrats;
}
