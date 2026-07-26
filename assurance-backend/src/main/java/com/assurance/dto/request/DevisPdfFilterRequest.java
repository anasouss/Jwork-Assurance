package com.assurance.dto.request;

import lombok.Data;

import java.util.List;

@Data
public class DevisPdfFilterRequest {
    private List<Long> vehiculeIds;
    private List<Long> usageIds;
}
