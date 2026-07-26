package com.assurance.service;

import com.assurance.entity.ParametreApplication;
import com.assurance.repository.ParametreApplicationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ParametreApplicationService {

    private final ParametreApplicationRepository parametreApplicationRepository;

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
}
