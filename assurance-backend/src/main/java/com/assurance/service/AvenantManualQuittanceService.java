package com.assurance.service;

import com.assurance.dto.request.AvenantRequest;
import com.assurance.dto.request.CreateContratRequest;
import com.assurance.entity.Contrat;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.TypeContrat;
import com.assurance.exception.BadRequestException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@Service
public class AvenantManualQuittanceService {

    public QuittanceCalculService.Resultat calculate(Contrat contrat, AvenantRequest request) {
        if (request.getQuittances() == null) {
            return null;
        }
        if (contrat.getTypeContrat() != TypeContrat.PARTICULIER
                || !("EXG_M".equalsIgnoreCase(request.getCodeTypeMouvement())
                || "MOG_M".equalsIgnoreCase(request.getCodeTypeMouvement()))) {
            throw new BadRequestException("La quittance manuelle est reservee aux extensions et modifications de garanties particulier.");
        }
        if (request.getQuittances().isEmpty()) {
            throw new BadRequestException("Renseignez la quittance differentielle de l'avenant.");
        }
        Set<CategorieQuittance> categories = EnumSet.noneOf(CategorieQuittance.class);
        List<QuittanceCalculService.Ligne> lignes = new ArrayList<>();
        BigDecimal[] totals = {money(null), money(null), money(null), money(null), money(null)};
        boolean entered = false;
        for (CreateContratRequest.QuittanceInput input : request.getQuittances()) {
            if (input == null || input.getCategorie() == null
                    || !EnumSet.of(CategorieQuittance.AUTOMOBILE, CategorieQuittance.CORPOREL,
                    CategorieQuittance.EVCAT).contains(input.getCategorie())
                    || !categories.add(input.getCategorie())) {
                throw new BadRequestException("Categorie de quittance invalide ou dupliquee.");
            }
            BigDecimal[] raw = {input.getPrimeNette(), input.getTaxe(), input.getTaxeParafiscale(),
                    input.getAccessoire(), input.getCnpac()};
            BigDecimal[] amounts = new BigDecimal[raw.length];
            BigDecimal total = money(null);
            for (int index = 0; index < raw.length; index++) {
                entered |= raw[index] != null;
                amounts[index] = money(raw[index]);
                if ("EXG_M".equalsIgnoreCase(request.getCodeTypeMouvement()) && amounts[index].signum() < 0) {
                    throw new BadRequestException("Les montants d'une extension de garanties doivent etre positifs ou nuls.");
                }
                total = total.add(amounts[index]);
                totals[index] = totals[index].add(amounts[index]);
            }
            if (input.getPrimeTotale() != null && money(input.getPrimeTotale()).compareTo(total) != 0) {
                throw new BadRequestException("Le total doit correspondre a la somme des composantes de la quittance.");
            }
            int order = switch (input.getCategorie()) {
                case AUTOMOBILE -> 10;
                case CORPOREL -> 20;
                default -> 30;
            };
            lignes.add(new QuittanceCalculService.Ligne(input.getCategorie(), order, false,
                    amounts[0], amounts[1], amounts[2], amounts[3], amounts[4], total));
        }
        if (!entered) {
            throw new BadRequestException("Renseignez au moins un montant, meme nul, pour la quittance de l'avenant.");
        }
        lignes.sort(java.util.Comparator.comparingInt(QuittanceCalculService.Ligne::ordre));
        BigDecimal total = totals[0].add(totals[1]).add(totals[2]).add(totals[3]).add(totals[4]);
        lignes.add(new QuittanceCalculService.Ligne(CategorieQuittance.TOTAL, 99, true,
                totals[0], totals[1], totals[2], totals[3], totals[4], total));
        return new QuittanceCalculService.Resultat(lignes,
                totals[0], totals[1], totals[2], totals[3], totals[4], total);
    }

    private BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }
}
