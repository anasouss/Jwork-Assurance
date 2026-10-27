package com.assurance.service;

import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.LigneQuittance;
import com.assurance.entity.Quittance;
import com.assurance.entity.TiersCompagnie;
import com.assurance.enums.CategorieQuittance;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.LigneQuittanceRepository;
import com.assurance.repository.AffectationQuittanceCompagnieRepository;
import com.assurance.repository.QuittanceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class AssistanceQuittanceService {

    private static final BigDecimal ZERO = new BigDecimal("0.00");

    private final QuittanceRepository quittanceRepository;
    private final LigneQuittanceRepository ligneQuittanceRepository;
    private final TiersCompagnieService tiersCompagnieService;
    private final AffectationQuittanceCompagnieRepository affectationRepository;

    @Transactional
    public Quittance synchroniser(AssistanceContrat assistance) {
        if (assistance == null || assistance.getElementFacturable() == null) {
            throw new BadRequestException("L'élément facturable de l'assistance est obligatoire");
        }
        ElementFacturable element = assistance.getElementFacturable();
        TiersCompagnie tiers = tiersCompagnieService.resolveAssistance(assistance.getCompagnieAssistance());
        Quittance quittance = quittanceRepository
                .findFirstByElementFacturableIdAndGlobaleTrueOrderByCreatedAtAsc(element.getId())
                .orElseGet(Quittance::new);
        boolean nouvelle = quittance.getId() == null;
        if (!nouvelle && affectationRepository.existsByQuittanceId(quittance.getId())) {
            if (sameAccountingSnapshot(quittance, assistance, element, tiers)) {
                return quittance;
            }
            throw new BadRequestException(
                    "L'assistance est déjà affectée à une quittance compagnie et ne peut plus être recalculée"
            );
        }
        quittance.setContrat(assistance.getContrat());
        quittance.setMouvementContrat(assistance.getMouvementContrat());
        quittance.setElementFacturable(element);
        quittance.setTiersCompagnie(tiers);
        quittance.setNumeroQuittance(internalReference(assistance));
        quittance.setType(assistance.getTypeQuittance() == null ? "ASSISTANCE" : assistance.getTypeQuittance());
        quittance.setCategorie(CategorieQuittance.ASSISTANCE.name());
        quittance.setPeriode(1);
        quittance.setDateDebut(element.getDateDebut());
        quittance.setDateFin(element.getDateFin());
        quittance.setPrimeNette(amount(element.getPrimeNette()));
        quittance.setTaxe(amount(element.getTaxe()));
        quittance.setTaxeParafiscale(amount(element.getTaxeParafiscale()));
        quittance.setAccessoire(amount(element.getAccessoire()));
        quittance.setCnpac(amount(element.getCnpac()));
        quittance.setPrimeTotale(amount(element.getPrimeTotale()));
        if (nouvelle) {
            quittance.setPayee(false);
        }
        quittance.setGlobale(true);
        quittance.setAlternative(false);
        quittance = quittanceRepository.save(quittance);

        ligneQuittanceRepository.deleteByQuittanceId(quittance.getId());
        ligneQuittanceRepository.save(LigneQuittance.builder()
                .quittance(quittance)
                .categorie(CategorieQuittance.ASSISTANCE)
                .ordre(10)
                .globale(false)
                .primeNette(quittance.getPrimeNette())
                .taxe(quittance.getTaxe())
                .taxeParafiscale(quittance.getTaxeParafiscale())
                .accessoire(quittance.getAccessoire())
                .cnpac(quittance.getCnpac())
                .primeTotale(quittance.getPrimeTotale())
                .build());
        return quittance;
    }

    private String internalReference(AssistanceContrat assistance) {
        String reference = assistance.getNumeroContratOuQuittance();
        if (reference == null || reference.isBlank()) {
            reference = assistance.getNumeroPoliceContrat();
        }
        return reference == null || reference.isBlank() ? "AST-" + assistance.getId() : reference.trim();
    }

    private BigDecimal amount(BigDecimal value) {
        return value == null ? ZERO : value;
    }

    private boolean sameAccountingSnapshot(
            Quittance quittance,
            AssistanceContrat assistance,
            ElementFacturable element,
            TiersCompagnie tiers
    ) {
        return Objects.equals(quittance.getContrat().getId(), assistance.getContrat().getId())
                && quittance.getTiersCompagnie() != null
                && Objects.equals(quittance.getTiersCompagnie().getId(), tiers.getId())
                && Objects.equals(quittance.getNumeroQuittance(), internalReference(assistance))
                && Objects.equals(quittance.getDateDebut(), element.getDateDebut())
                && Objects.equals(quittance.getDateFin(), element.getDateFin())
                && amount(quittance.getPrimeNette()).compareTo(amount(element.getPrimeNette())) == 0
                && amount(quittance.getTaxe()).compareTo(amount(element.getTaxe())) == 0
                && amount(quittance.getTaxeParafiscale()).compareTo(amount(element.getTaxeParafiscale())) == 0
                && amount(quittance.getAccessoire()).compareTo(amount(element.getAccessoire())) == 0
                && amount(quittance.getCnpac()).compareTo(amount(element.getCnpac())) == 0
                && amount(quittance.getPrimeTotale()).compareTo(amount(element.getPrimeTotale())) == 0;
    }
}
