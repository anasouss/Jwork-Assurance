package com.assurance.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class SelectionInstrumentsBordereauRequest {

    @NotEmpty
    @Size(max = 200)
    private List<@NotNull Long> instrumentIds = new ArrayList<>();
}
