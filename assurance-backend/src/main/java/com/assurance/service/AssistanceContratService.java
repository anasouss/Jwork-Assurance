package com.assurance.service;

import com.assurance.dto.request.UpsertAssistanceContratRequest;
import com.assurance.dto.response.AssistanceContratResponse;
import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.CompagnieAssistance;
import com.assurance.entity.Contrat;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.ProduitAssistance;
import com.assurance.entity.TarifProduitAssistance;
import com.assurance.entity.Vehicule;
import com.assurance.enums.NatureElementFacturable;
import com.assurance.enums.StatutElementFacturable;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.CompagnieAssistanceRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.ElementFacturableRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.ProduitAssistanceRepository;
import com.assurance.repository.VehiculeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class AssistanceContratService {

    private final ContratRepository contratRepository;
    private final VehiculeRepository vehiculeRepository;
    private final MouvementContratRepository mouvementContratRepository;
    private final CompagnieAssistanceRepository compagnieAssistanceRepository;
    private final ProduitAssistanceRepository produitAssistanceRepository;
    private final AssistanceContratRepository assistanceContratRepository;
    private final ElementFacturableRepository elementFacturableRepository;
    private final TarifProduitAssistanceService tarifProduitAssistanceService;
    private final EcheanceService echeanceService;

    @Transactional
    public AssistanceContratResponse upsert(String agenceId, String contratId, UpsertAssistanceContratRequest request) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        Vehicule vehicule = vehiculeRepository.findById(request.getVehiculeId())
                .orElseThrow(() -> new ResourceNotFoundException("Vehicule", request.getVehiculeId()));
        if (vehicule.getContrat() == null || !vehicule.getContrat().getId().equals(contrat.getId())) {
            throw new BadRequestException("Le vehicule ne correspond pas au contrat");
        }
        MouvementContrat mouvement = request.getMouvementContratId() == null ? null :
                mouvementContratRepository.findById(request.getMouvementContratId())
                        .orElseThrow(() -> new ResourceNotFoundException("MouvementContrat", request.getMouvementContratId()));
        CompagnieAssistance compagnieAssistance = compagnieAssistanceRepository.findById(request.getCompagnieAssistanceId())
                .orElseThrow(() -> new ResourceNotFoundException("CompagnieAssistance", request.getCompagnieAssistanceId()));
        ProduitAssistance produitAssistance = produitAssistanceRepository.findById(request.getProduitAssistanceId())
                .orElseThrow(() -> new ResourceNotFoundException("ProduitAssistance", request.getProduitAssistanceId()));
        if (!produitAssistance.getCompagnieAssistance().getId().equals(compagnieAssistance.getId())) {
            throw new BadRequestException("Le produit d'assistance ne correspond pas a la compagnie selectionnee");
        }
        if (produitAssistance.getUsages() != null && !produitAssistance.getUsages().isEmpty()
                && vehicule.getUsage() != null
                && produitAssistance.getUsages().stream().noneMatch(usage -> usage.getId().equals(vehicule.getUsage().getId()))) {
            throw new BadRequestException("Produit d'assistance incompatible avec l'usage du vehicule");
        }

        LocalDate dateSouscription = firstNonNull(request.getDateSouscription(), request.getDateEffet(), vehicule.getDateEffet(), contrat.getDateEffet(), LocalDate.now());
        LocalDate dateEffet = firstNonNull(request.getDateEffet(), dateSouscription);
        String echeanceCode = echeanceService.normalizeCode(firstNonNull(request.getEcheanceCode(), contrat.getEcheance()));
        LocalDate dateEcheance = echeanceService.resolveDateEcheance(dateEffet, echeanceCode, contrat.getDateEcheance());
        int trimestres = resolveAssistanceQuarterCount(dateEffet, dateEcheance);
        BigDecimal prorata = BigDecimal.valueOf(trimestres).divide(BigDecimal.valueOf(4), 8, RoundingMode.HALF_UP);
        TarifProduitAssistance tarif = tarifProduitAssistanceService.resolveTarifForDate(produitAssistance, dateSouscription);
        BigDecimal montantHt = tarif == null ? BigDecimal.ZERO : tarif.getMontantHt();
        BigDecimal montantTtc = tarif == null ? BigDecimal.ZERO : tarif.getMontantTtc();
        BigDecimal primeNette = montantHt.multiply(prorata).setScale(2, RoundingMode.HALF_UP);
        BigDecimal primeTotale = montantTtc.multiply(prorata).setScale(2, RoundingMode.HALF_UP);

        AssistanceContrat assistance = assistanceContratRepository
                .findFirstByContratIdAndVehiculeIdAndActifTrueOrderByCreatedAtDesc(contrat.getId(), vehicule.getId())
                .orElseGet(AssistanceContrat::new);
        assistance.setContrat(contrat);
        assistance.setMouvementContrat(mouvement);
        assistance.setVehicule(vehicule);
        assistance.setCompagnieAssuranceContrat(contrat.getCompagnieAssurance());
        assistance.setCompagnieAssistance(compagnieAssistance);
        assistance.setProduitAssistance(produitAssistance);
        assistance.setTarifProduitAssistance(tarif);
        assistance.setProduit(produitAssistance.getLibelle());
        assistance.setDateSouscription(dateSouscription);
        assistance.setDateEffet(dateEffet);
        assistance.setDateEcheance(dateEcheance);
        assistance.setEcheanceCode(echeanceCode);
        assistance.setDuree(trimestres);
        assistance.setUnite("TRIMESTRE");
        assistance.setNumeroDossier(contrat.getNumeroDossier());
        assistance.setNumeroPoliceContrat(contrat.getNumeroPolice());
        assistance.setNumeroContratOuQuittance(request.getNumeroContratOuQuittance());
        assistance.setTypeQuittance(request.getTypeQuittance());
        assistance.setPrimeNette(primeNette);
        assistance.setPrimeTotale(primeTotale);
        assistance.setActif(true);
        assistance = assistanceContratRepository.save(assistance);

        ElementFacturable element = assistance.getElementFacturable();
        if (element == null) {
            element = new ElementFacturable();
        }
        element.setAgence(contrat.getAgence());
        element.setContrat(contrat);
        element.setMouvementContrat(mouvement);
        element.setCompagnieAssurance(contrat.getCompagnieAssurance());
        element.setNature(NatureElementFacturable.ASSISTANCE);
        element.setStatut(StatutElementFacturable.A_QUITTANCER);
        element.setReferenceSource(assistance.getId());
        element.setLibelle("Assistance - " + produitAssistance.getLibelle());
        element.setDateDebut(dateEffet);
        element.setDateFin(dateEcheance);
        element.setPrimeNette(primeNette);
        element.setTaxe(primeTotale.subtract(primeNette).max(BigDecimal.ZERO));
        element.setTaxeParafiscale(BigDecimal.ZERO);
        element.setAccessoire(BigDecimal.ZERO);
        element.setCnpac(BigDecimal.ZERO);
        element.setPrimeTotale(primeTotale);
        element.setActif(true);
        element = elementFacturableRepository.save(element);
        assistance.setElementFacturable(element);
        assistance = assistanceContratRepository.save(assistance);

        return toResponse(assistance, trimestres, prorata);
    }

    private AssistanceContratResponse toResponse(AssistanceContrat assistance, int trimestres, BigDecimal prorata) {
        return AssistanceContratResponse.builder()
                .id(assistance.getId())
                .contratId(assistance.getContrat() != null ? assistance.getContrat().getId() : null)
                .mouvementContratId(assistance.getMouvementContrat() != null ? assistance.getMouvementContrat().getId() : null)
                .vehiculeId(assistance.getVehicule() != null ? assistance.getVehicule().getId() : null)
                .compagnieAssistanceId(assistance.getCompagnieAssistance() != null ? assistance.getCompagnieAssistance().getId() : null)
                .produitAssistanceId(assistance.getProduitAssistance() != null ? assistance.getProduitAssistance().getId() : null)
                .tarifProduitAssistanceId(assistance.getTarifProduitAssistance() != null ? assistance.getTarifProduitAssistance().getId() : null)
                .produit(assistance.getProduit())
                .dateSouscription(assistance.getDateSouscription())
                .dateEffet(assistance.getDateEffet())
                .dateEcheance(assistance.getDateEcheance())
                .echeanceCode(assistance.getEcheanceCode())
                .trimestres(trimestres)
                .prorataRatio(prorata.setScale(2, RoundingMode.HALF_UP))
                .primeNette(assistance.getPrimeNette())
                .primeTotale(assistance.getPrimeTotale())
                .elementFacturableId(assistance.getElementFacturable() != null ? assistance.getElementFacturable().getId() : null)
                .build();
    }

    private int resolveAssistanceQuarterCount(LocalDate dateEffet, LocalDate dateEcheance) {
        if (dateEffet == null || dateEcheance == null || dateEcheance.isBefore(dateEffet)) {
            return 4;
        }
        LocalDate endExclusive = dateEcheance.plusDays(1);
        long months = (long) (endExclusive.getYear() - dateEffet.getYear()) * 12
                + (endExclusive.getMonthValue() - dateEffet.getMonthValue());
        if (dateEffet.plusMonths(months).isBefore(endExclusive)) {
            months++;
        }
        months = Math.max(1, months);
        return Math.max(1, Math.min(4, (int) Math.ceil(months / 3.0d)));
    }

    @SafeVarargs
    private final <T> T firstNonNull(T... values) {
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }
}
