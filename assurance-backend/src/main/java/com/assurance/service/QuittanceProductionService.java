package com.assurance.service;

import com.assurance.entity.Contrat;
import com.assurance.entity.ContratGarantie;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.LigneQuittance;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.Quittance;
import com.assurance.entity.Remorque;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.entity.Vehicule;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.NatureElementFacturable;
import com.assurance.enums.StatutElementFacturable;
import com.assurance.repository.ElementFacturableRepository;
import com.assurance.repository.LigneQuittanceRepository;
import com.assurance.repository.QuittanceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class QuittanceProductionService {

    private final QuittanceCalculService quittanceCalculService;
    private final ElementFacturableRepository elementFacturableRepository;
    private final QuittanceRepository quittanceRepository;
    private final LigneQuittanceRepository ligneQuittanceRepository;
    private final ElementFacturableCibleService elementFacturableCibleService;

    public Quittance genererPourMouvement(
            Contrat contrat,
            MouvementContrat mouvement,
            TypeMouvementContrat typeMouvement,
            List<ContratGarantie> garanties,
            List<Vehicule> vehicules,
            List<Remorque> remorques
    ) {
        int fallbackCnpac = Math.max(1, (vehicules == null ? 0 : vehicules.size()) + (remorques == null ? 0 : remorques.size()));
        int unitesCnpac = quittanceCalculService.compterUnitesCnpac(garanties, fallbackCnpac);
        QuittanceCalculService.Resultat calcul = quittanceCalculService.calculer(contrat, typeMouvement, garanties, unitesCnpac);
        return genererPourMouvement(contrat, mouvement, typeMouvement, calcul, garanties, vehicules, remorques);
    }

    public Quittance genererPourMouvement(
            Contrat contrat,
            MouvementContrat mouvement,
            TypeMouvementContrat typeMouvement,
            QuittanceCalculService.Resultat calcul
    ) {
        return genererPourMouvement(contrat, mouvement, typeMouvement, calcul, List.of(), List.of(), List.of());
    }

    public Quittance genererPourMouvement(
            Contrat contrat,
            MouvementContrat mouvement,
            TypeMouvementContrat typeMouvement,
            QuittanceCalculService.Resultat calcul,
            List<ContratGarantie> garanties,
            List<Vehicule> vehicules,
            List<Remorque> remorques
    ) {
        ElementFacturable element = elementFacturableRepository.save(ElementFacturable.builder()
                .agence(contrat.getAgence())
                .contrat(contrat)
                .mouvementContrat(mouvement)
                .compagnieAssurance(contrat.getCompagnieAssurance())
                .nature(resolveNature(typeMouvement))
                .statut(StatutElementFacturable.A_QUITTANCER)
                .referenceSource(contrat.getNumeroContrat())
                .libelle(typeMouvement.getLibelle())
                .dateDebut(mouvement.getDateEffet())
                .dateFin(mouvement.getDateEcheance())
                .primeNette(calcul.primeNette())
                .taxe(calcul.taxe())
                .taxeParafiscale(calcul.taxeParafiscale())
                .accessoire(calcul.accessoire())
                .cnpac(calcul.cnpac())
                .primeTotale(calcul.primeTotale())
                .actif(true)
                .build());

        Quittance quittance = quittanceRepository.save(Quittance.builder()
                .contrat(contrat)
                .mouvementContrat(mouvement)
                .elementFacturable(element)
                .compagnieAssurance(contrat.getCompagnieAssurance())
                .numeroQuittance(genererNumeroQuittance(contrat, mouvement, typeMouvement))
                .type(typeMouvement.getCode())
                .categorie(CategorieQuittance.TOTAL.name())
                .periode(1)
                .dateDebut(mouvement.getDateEffet())
                .dateFin(mouvement.getDateEcheance())
                .primeNette(calcul.primeNette())
                .taxe(calcul.taxe())
                .taxeParafiscale(calcul.taxeParafiscale())
                .accessoire(calcul.accessoire())
                .cnpac(calcul.cnpac())
                .primeTotale(calcul.primeTotale())
                .payee(false)
                .globale(true)
                .alternative(false)
                .build());

        for (QuittanceCalculService.Ligne ligne : calcul.lignes()) {
            LigneQuittance ligneQuittance = ligneQuittanceRepository.save(LigneQuittance.builder()
                    .quittance(quittance)
                    .categorie(ligne.categorie())
                    .ordre(ligne.ordre())
                    .globale(ligne.globale())
                    .primeNette(ligne.primeNette())
                    .taxe(ligne.taxe())
                    .taxeParafiscale(ligne.taxeParafiscale())
                    .accessoire(ligne.accessoire())
                    .cnpac(ligne.cnpac())
                    .primeTotale(ligne.primeTotale())
                    .build());
            quittance.getLignes().add(ligneQuittance);
        }

        elementFacturableCibleService.generer(element, contrat, garanties, vehicules, remorques);
        contrat.getElementsFacturables().add(element);
        contrat.getQuittances().add(quittance);
        return quittance;
    }

    private NatureElementFacturable resolveNature(TypeMouvementContrat typeMouvement) {
        if (typeMouvement.getCategorie() == null) {
            return NatureElementFacturable.MOUVEMENT_CONTRAT;
        }
        return switch (typeMouvement.getCategorie()) {
            case AFFAIRE_NOUVELLE -> NatureElementFacturable.CONTRAT;
            case RENOUVELLEMENT, AVENANT, DOCUMENT, SERVICE -> NatureElementFacturable.MOUVEMENT_CONTRAT;
        };
    }

    private String genererNumeroQuittance(Contrat contrat, MouvementContrat mouvement, TypeMouvementContrat typeMouvement) {
        String base = contrat.getNumeroContrat() == null || contrat.getNumeroContrat().isBlank() ? "CONTRAT" : contrat.getNumeroContrat();
        String suffix = mouvement.getId() == null ? typeMouvement.getCode() : String.valueOf(mouvement.getId());
        return base + "-" + typeMouvement.getCode() + "-" + suffix;
    }
}
