package com.assurance.service;

import com.assurance.entity.ExigenceDocumentSinistre;
import com.assurance.enums.TypeDocumentSinistre;
import com.assurance.repository.ExigenceDocumentSinistreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SinistreDocumentRequirementService {

    private final ExigenceDocumentSinistreRepository repository;

    @Transactional(readOnly = true)
    public List<ExigenceDocumentSinistre> applicable(Long agenceId) {
        Map<TypeDocumentSinistre, ExigenceDocumentSinistre> effective = new LinkedHashMap<>();
        repository.findApplicable(agenceId).stream()
                .sorted(Comparator
                        .comparingInt(this::specificity)
                        .thenComparingInt(ExigenceDocumentSinistre::getOrdre)
                        .thenComparing(ExigenceDocumentSinistre::getId))
                .forEach(requirement -> effective.put(requirement.getTypeDocument(), requirement));
        return effective.values().stream()
                .sorted(Comparator.comparingInt(ExigenceDocumentSinistre::getOrdre)
                        .thenComparing(ExigenceDocumentSinistre::getId))
                .toList();
    }

    private int specificity(ExigenceDocumentSinistre requirement) {
        return requirement.getAgence() == null ? 0 : 1;
    }
}
