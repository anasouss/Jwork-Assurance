package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AnnulerDocumentClientRequest {

    @NotBlank
    @Size(max = 500)
    private String motif;
}
