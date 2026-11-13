package com.assurance.service;

import com.assurance.entity.GarageSinistre;
import com.assurance.entity.Sinistre;
import com.assurance.enums.ModeReparationSinistre;
import com.assurance.enums.TypeDommageSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.GarageSinistreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SinistreQualificationService {
    private final GarageSinistreRepository garageRepository;
    private final PrestataireSinistreService prestataireService;

    public void apply(Sinistre sinistre, TypeDommageSinistre type, ModeReparationSinistre mode,
            Long garageId, BigDecimal responsabilite) {
        if (!isAutomobile(sinistre) && (type != null || mode != null || garageId != null)) {
            throw new BadRequestException("La qualification des dommages et de la reparation est reservee aux sinistres automobiles");
        }
        if (responsabilite != null && Set.of(0, 50, 100).stream()
                .noneMatch(value -> responsabilite.compareTo(BigDecimal.valueOf(value)) == 0)) {
            throw new BadRequestException("La responsabilite RC doit etre 0, 50 ou 100");
        }
        GarageSinistre garage = garageId == null ? null
                : garageRepository.findByIdAndAgenceId(garageId, sinistre.getAgence().getId())
                        .orElseThrow(() -> new ResourceNotFoundException("GarageSinistre", garageId));
        if (mode == ModeReparationSinistre.PEC && garage == null) {
            throw new BadRequestException("La PEC exige un garage conventionné pour la compagnie du sinistre");
        }
        if (garage != null && (sinistre.getGarage() == null
                || !java.util.Objects.equals(sinistre.getGarage().getId(), garageId) || mode != sinistre.getModeReparation())) {
            prestataireService.assertGarage(sinistre, garage, mode, java.time.LocalDate.now());
        }
        sinistre.setTypeDommage(type);
        sinistre.setModeReparation(mode);
        if (garage == null || sinistre.getGarage() == null
                || !java.util.Objects.equals(sinistre.getGarage().getId(), garageId)) {
            sinistre.setGarageNomSnapshot(garage == null ? null : garage.getRaisonSociale());
        }
        sinistre.setGarage(garage);
        sinistre.setTauxResponsabilite(responsabilite);
    }

    public static boolean isAutomobile(Sinistre sinistre) {
        return sinistre.getCouverture() != null
                && "AUTOMOBILE".equals(sinistre.getCouverture().getBrancheCode());
    }

    public static java.util.List<String> declarationBlockers(Sinistre sinistre) {
        java.util.List<String> blockers = new java.util.ArrayList<>();
        if (sinistre.getReferenceCompagnie() == null || sinistre.getReferenceCompagnie().trim().isEmpty()) {
            blockers.add("Renseignez la reference compagnie avant de declarer le sinistre");
        }
        if (isAutomobile(sinistre)) {
            if (sinistre.getTypeDommage() == null) {
                blockers.add("Renseignez le type de dommage automobile");
            }
            if (sinistre.getModeReparation() == null) {
                blockers.add("Renseignez le mode de reparation automobile");
            }
        }
        return java.util.List.copyOf(blockers);
    }
}
