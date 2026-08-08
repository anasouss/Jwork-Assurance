package com.assurance.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class SelectionCreancesClientRequest {

    @Size(max = 100)
    private List<Long> elementFacturableIds = new ArrayList<>();

    @Size(max = 100)
    private List<Long> documentClientIds = new ArrayList<>();
}
