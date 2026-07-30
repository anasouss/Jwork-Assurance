package com.assurance.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class AddLotsAttestationRequest {

    @Valid
    @NotEmpty
    private List<AddLotAttestationRequest> lots = new ArrayList<>();
}
