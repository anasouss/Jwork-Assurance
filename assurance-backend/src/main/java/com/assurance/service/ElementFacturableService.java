package com.assurance.service;

import com.assurance.dto.response.ElementFacturableResponse;
import com.assurance.dto.response.QuittanceResponse;
import com.assurance.entity.Contrat;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.LigneQuittance;
import com.assurance.enums.Fractionnement;
import com.assurance.repository.ElementFacturableRepository;
import com.assurance.repository.LigneQuittanceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ElementFacturableService {

    private final ElementFacturableRepository elementFacturableRepository;
    private final LigneQuittanceRepository ligneQuittanceRepository;

    @Transactional(readOnly = true)
    public List<ElementFacturableResponse> list(Long agenceId) {
        return elementFacturableRepository.findByAgenceIdOrderByCreatedAtDesc(agenceId).stream()
                .map(this::toResponse)
                .toList();
    }

    private ElementFacturableResponse toResponse(ElementFacturable element) {
        return ElementFacturableResponse.builder()
                .id(element.getId())
                .contratId(element.getContrat() != null ? element.getContrat().getId() : null)
                .numeroContrat(element.getContrat() != null ? element.getContrat().getNumeroContrat() : null)
                .mouvementContratId(element.getMouvementContrat() != null ? element.getMouvementContrat().getId() : null)
                .codeMouvement(element.getMouvementContrat() != null && element.getMouvementContrat().getTypeMouvement() != null ? element.getMouvementContrat().getTypeMouvement().getCode() : null)
                .libelleMouvement(element.getMouvementContrat() != null && element.getMouvementContrat().getTypeMouvement() != null ? element.getMouvementContrat().getTypeMouvement().getLibelle() : null)
                .compagnieAssuranceId(element.getCompagnieAssurance() != null ? element.getCompagnieAssurance().getId() : null)
                .fractionnement(resolveFractionnementLabel(element.getContrat()))
                .splitAllowed(resolveExpectedSplitCount(element.getContrat()) > 1)
                .expectedSplitCount(resolveExpectedSplitCount(element.getContrat()))
                .nature(element.getNature() != null ? element.getNature().name() : null)
                .statut(element.getStatut() != null ? element.getStatut().name() : null)
                .referenceSource(element.getReferenceSource())
                .libelle(element.getLibelle())
                .dateDebut(element.getDateDebut())
                .dateFin(element.getDateFin())
                .primeNette(element.getPrimeNette())
                .taxe(element.getTaxe())
                .taxeParafiscale(element.getTaxeParafiscale())
                .accessoire(element.getAccessoire())
                .cnpac(element.getCnpac())
                .primeTotale(element.getPrimeTotale())
                .lignesQuittance(ligneQuittanceRepository.findByQuittance_ElementFacturable_IdOrderByOrdreAsc(element.getId()).stream()
                        .map(this::toLigneResponse)
                        .toList())
                .build();
    }

    private QuittanceResponse.Ligne toLigneResponse(LigneQuittance ligne) {
        return QuittanceResponse.Ligne.builder()
                .categorie(ligne.getCategorie() != null ? ligne.getCategorie().name() : null)
                .ordre(ligne.getOrdre())
                .globale(ligne.getGlobale())
                .primeNette(ligne.getPrimeNette())
                .taxe(ligne.getTaxe())
                .taxeParafiscale(ligne.getTaxeParafiscale())
                .accessoire(ligne.getAccessoire())
                .cnpac(ligne.getCnpac())
                .primeTotale(ligne.getPrimeTotale())
                .build();
    }

    private String resolveFractionnementLabel(Contrat contrat) {
        if (contrat == null || contrat.getTypeContrat() == null) {
            return "";
        }
        if (contrat.getFractionnement() != null) {
            return contrat.getFractionnement().name();
        }
        if (contrat.getConvention() != null && contrat.getConvention().getFractionnement() != null) {
            return contrat.getConvention().getFractionnement().name();
        }
        return "";
    }

    private int resolveExpectedSplitCount(Contrat contrat) {
        if (contrat == null || contrat.getTypeContrat() == null) {
            return 1;
        }
        if (contrat.getTypeContrat().name().equalsIgnoreCase("PARTICULIER")) {
            return 1;
        }
        Fractionnement fractionnement = contrat.getFractionnement() != null
                ? contrat.getFractionnement()
                : contrat.getConvention() != null ? contrat.getConvention().getFractionnement() : null;
        if (fractionnement == null) {
            return 1;
        }
        return switch (fractionnement) {
            case MENSUEL -> 12;
            case TRIMESTRIEL -> 4;
            case SEMESTRIEL -> 2;
            case ANNUEL -> 1;
        };
    }
}
