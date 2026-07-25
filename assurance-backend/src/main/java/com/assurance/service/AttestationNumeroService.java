package com.assurance.service;

import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.GroupeUsageAttestation;
import com.assurance.entity.Usage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AttestationNumeroService {

    public String normaliser(String valeur, CompagnieAssurance compagnie, Usage usage) {
        if (!hasText(valeur)) {
            return null;
        }
        String prefixe = normaliserPrefixe(compagnie != null ? compagnie.getPrefixeAttestation() : null);
        String codeGroupe = codeGroupe(usage);
        if (!hasText(prefixe) || !hasText(codeGroupe)) {
            return valeur.trim();
        }
        String serie = extraireSerie(valeur, prefixe, codeGroupe);
        if (!hasText(serie)) {
            return valeur.trim();
        }
        return prefixe + codeGroupe + serie;
    }

    public List<String> candidats(String valeur, CompagnieAssurance compagnie, Usage usage) {
        Set<String> valeurs = new LinkedHashSet<>();
        if (!hasText(valeur)) {
            return new ArrayList<>(valeurs);
        }
        valeurs.add(valeur.trim().toUpperCase(Locale.ROOT));

        String prefixe = normaliserPrefixe(compagnie != null ? compagnie.getPrefixeAttestation() : null);
        String codeGroupe = codeGroupe(usage);
        if (!hasText(prefixe) || !hasText(codeGroupe)) {
            return new ArrayList<>(valeurs);
        }
        String serie = extraireSerie(valeur, prefixe, codeGroupe);
        if (!hasText(serie)) {
            return new ArrayList<>(valeurs);
        }

        valeurs.add((prefixe + codeGroupe + serie).toUpperCase(Locale.ROOT));
        valeurs.add((prefixe + serie).toUpperCase(Locale.ROOT));
        valeurs.add((prefixe + " " + serie).toUpperCase(Locale.ROOT));
        return new ArrayList<>(valeurs);
    }

    public String codeGroupe(Usage usage) {
        GroupeUsageAttestation groupe = usage != null ? usage.getGroupeUsageAttestation() : null;
        if (groupe == null || !Boolean.TRUE.equals(groupe.getVisibleStock()) || !Boolean.TRUE.equals(groupe.getActif())) {
            return null;
        }
        return normaliserToken(groupe.getCode());
    }

    public String normaliserPrefixe(String prefixe) {
        if (!hasText(prefixe)) {
            return "";
        }
        return prefixe.trim().replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
    }

    private String extraireSerie(String valeur, String prefixe, String codeGroupe) {
        String compacte = normaliserSerie(valeur);
        String prefixeComplet = prefixe + codeGroupe;
        if (compacte.startsWith(prefixeComplet)) {
            return compacte.substring(prefixeComplet.length());
        }
        if (compacte.startsWith(prefixe)) {
            return compacte.substring(prefixe.length());
        }
        return compacte;
    }

    private String normaliserSerie(String serie) {
        if (!hasText(serie)) {
            return "";
        }
        return serie.trim().replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
    }

    private String normaliserToken(String valeur) {
        if (!hasText(valeur)) {
            return null;
        }
        String normalized = Normalizer.normalize(valeur.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return normalized.replaceAll("[^A-Za-z0-9]+", "").toUpperCase(Locale.ROOT);
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
