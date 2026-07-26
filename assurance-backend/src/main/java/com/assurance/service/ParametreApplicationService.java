package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.ParametreApplication;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.ParametreApplicationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ParametreApplicationService {

    private final ParametreApplicationRepository parametreApplicationRepository;
    private final AgenceRepository agenceRepository;

    public String getValeur(Long agenceId, String code, String valeurParDefaut) {
        Optional<ParametreApplication> parametreAgence = agenceId == null ? Optional.empty()
                : parametreApplicationRepository.findByAgence_IdAndCodeIgnoreCaseAndActifTrue(agenceId, code);
        return parametreAgence
                .or(() -> parametreApplicationRepository.findByAgenceIsNullAndCodeIgnoreCaseAndActifTrue(code))
                .map(ParametreApplication::getValeur)
                .filter(value -> value != null && !value.isBlank())
                .orElse(valeurParDefaut);
    }

    public BigDecimal getDecimal(Long agenceId, String code, BigDecimal valeurParDefaut) {
        String valeur = getValeur(agenceId, code, null);
        if (valeur == null || valeur.isBlank()) {
            return valeurParDefaut;
        }
        try {
            return new BigDecimal(valeur.trim().replace(",", "."));
        } catch (NumberFormatException ignored) {
            return valeurParDefaut;
        }
    }

    public boolean getBoolean(Long agenceId, String code, boolean valeurParDefaut) {
        String valeur = getValeur(agenceId, code, null);
        if (valeur == null || valeur.isBlank()) {
            return valeurParDefaut;
        }
        return switch (valeur.trim().toLowerCase()) {
            case "1", "true", "yes", "oui", "on" -> true;
            case "0", "false", "no", "non", "off" -> false;
            default -> valeurParDefaut;
        };
    }

    @Transactional
    public ParametreApplication setValeur(Long agenceId, String code, String type, String valeur, String description) {
        Agence agence = agenceId == null ? null : agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        Optional<ParametreApplication> existing = agenceId == null
                ? parametreApplicationRepository.findByAgenceIsNullAndCodeIgnoreCase(code)
                : parametreApplicationRepository.findByAgence_IdAndCodeIgnoreCase(agenceId, code);
        ParametreApplication parametre = existing.orElseGet(() -> ParametreApplication.builder()
                .agence(agence)
                .code(code)
                .type(type)
                .valeur(valeur)
                .description(description)
                .actif(true)
                .build());
        parametre.setAgence(agence);
        parametre.setCode(code);
        parametre.setType(type);
        parametre.setValeur(valeur);
        parametre.setDescription(description);
        parametre.setActif(true);
        return parametreApplicationRepository.save(parametre);
    }

    @Transactional
    public ParametreApplication setBoolean(Long agenceId, String code, boolean valeur, String description) {
        return setValeur(agenceId, code, "BOOLEAN", Boolean.toString(valeur), description);
    }
}
