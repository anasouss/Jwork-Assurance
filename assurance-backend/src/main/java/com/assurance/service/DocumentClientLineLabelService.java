package com.assurance.service;

import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.Contrat;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.entity.MouvementVehicule;
import com.assurance.entity.Vehicule;
import com.assurance.enums.NatureElementFacturable;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.MouvementVehiculeRepository;
import com.assurance.repository.VehiculeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Objects;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class DocumentClientLineLabelService {

    private final AssistanceContratRepository assistanceContratRepository;
    private final MouvementVehiculeRepository mouvementVehiculeRepository;
    private final VehiculeRepository vehiculeRepository;

    public String label(LigneDocumentClient line, Integer fleetAnnexNumber) {
        if (line.getLibelleDocument() != null && !line.getLibelleDocument().isBlank()) {
            return line.getLibelleDocument().trim();
        }
        if (line.getId() == null
                && line.getElementFacturable() != null
                && line.getElementFacturable().getLibelleReleve() != null
                && !line.getElementFacturable().getLibelleReleve().isBlank()) {
            return line.getElementFacturable().getLibelleReleve().trim();
        }
        if (fleetAnnexNumber != null) {
            return "Police flotte : Voir annexe " + fleetAnnexNumber;
        }
        if (isAssistance(line)) {
            return assistanceContratRepository.findByElementFacturableId(line.getElementFacturable().getId())
                    .map(this::assistanceLabel)
                    .orElseGet(() -> value(line.getMouvement(), "Assistance"));
        }
        return insuranceLabel(line);
    }

    private boolean isAssistance(LigneDocumentClient line) {
        return line.getElementFacturable() != null
                && line.getElementFacturable().getNature() == NatureElementFacturable.ASSISTANCE;
    }

    private String assistanceLabel(AssistanceContrat assistance) {
        String productType = assistance.getProduitAssistance() == null
                ? null
                : assistance.getProduitAssistance().getType();
        String productName = value(
                assistance.getProduit(),
                assistance.getProduitAssistance() == null
                        ? null
                        : assistance.getProduitAssistance().getLibelle()
        );
        Vehicule vehicle = assistance.getVehicule();
        if (isTravelAssistance(productType)) {
            return appendDetail("Assurance Voyage", productName, productType);
        }
        String descriptor = vehicle == null ? "" : vehicleDescriptor(
                vehicle.getMarque() == null ? null : vehicle.getMarque().getLibelle(),
                vehicle.getImmatriculation(),
                vehicle.getImmatriculationProvisoire()
        );
        if (isAutomobileAssistance(productType) || vehicle != null) {
            return descriptor.isBlank()
                    ? appendDetail("Assistance Auto", productName, productType)
                    : "Assistance Auto : " + descriptor;
        }
        return appendDetail("Assistance", productName, productType);
    }

    private String insuranceLabel(LigneDocumentClient line) {
        if (isMiscellaneousRisk(line)) {
            return miscellaneousRiskLabel(line);
        }
        String movement = value(line.getMouvement(), "Affaire nouvelle");
        Long movementId = movementId(line);
        if (movementId != null) {
            String movementVehicle = mouvementVehiculeRepository.findByMouvementContratId(movementId).stream()
                    .findFirst()
                    .map(this::vehicleDescriptor)
                    .orElse("");
            if (!movementVehicle.isBlank()) {
                return automobileLabel(movement, movementVehicle);
            }
        }
        if (line.getElementFacturable() != null && line.getElementFacturable().getContrat() != null) {
            return vehiculeRepository.findActiveByContratIdOrderByCreatedAtAsc(
                            line.getElementFacturable().getContrat().getId()
                    ).stream()
                    .findFirst()
                    .map(this::vehicleDescriptor)
                    .filter(value -> !value.isBlank())
                    .map(value -> automobileLabel(movement, value))
                    .orElseGet(() -> automobileLabel(movement, ""));
        }
        return automobileLabel(movement, "");
    }

    private String automobileLabel(String movement, String descriptor) {
        String base = isNewBusiness(movement)
                ? "Assurance Auto"
                : movement + " - Assurance Auto";
        return descriptor.isBlank() ? base : base + " : " + descriptor;
    }

    private String miscellaneousRiskLabel(LigneDocumentClient line) {
        String movement = value(line.getMouvement(), "Affaire nouvelle");
        String precision = line.getElementFacturable() == null
                ? null
                : line.getElementFacturable().getLibelle();
        if (precision == null || precision.isBlank() || precision.equalsIgnoreCase(movement)) {
            return movement;
        }
        return movement + " : " + precision.trim();
    }

    private boolean isMiscellaneousRisk(LigneDocumentClient line) {
        Contrat contract = line.getElementFacturable() == null
                ? null
                : line.getElementFacturable().getContrat();
        return contract != null
                && contract.getBrancheAssurance() != null
                && "RISQUES_DIVERS".equalsIgnoreCase(contract.getBrancheAssurance().getCode());
    }

    private boolean isTravelAssistance(String type) {
        return type != null && type.toLowerCase(Locale.ROOT).contains("voyage");
    }

    private boolean isAutomobileAssistance(String type) {
        String normalized = type == null ? "" : type.toLowerCase(Locale.ROOT);
        return type != null
                && (normalized.contains("automobile") || normalized.contains("auto"));
    }

    private boolean isNewBusiness(String movement) {
        return movement == null || movement.isBlank() || "affaire nouvelle".equalsIgnoreCase(movement.trim());
    }

    private String appendDetail(String base, String detail, String type) {
        if (detail == null || detail.isBlank()
                || detail.equalsIgnoreCase(base)
                || (type != null && detail.equalsIgnoreCase(type))) {
            return base;
        }
        return base + " : " + detail.trim();
    }

    private Long movementId(LigneDocumentClient line) {
        if (line.getQuittance() != null && line.getQuittance().getMouvementContrat() != null) {
            return line.getQuittance().getMouvementContrat().getId();
        }
        if (line.getElementFacturable() != null
                && line.getElementFacturable().getMouvementContrat() != null) {
            return line.getElementFacturable().getMouvementContrat().getId();
        }
        return null;
    }

    private String vehicleDescriptor(Vehicule vehicle) {
        return vehicleDescriptor(
                vehicle.getMarque() == null ? null : vehicle.getMarque().getLibelle(),
                vehicle.getImmatriculation(),
                vehicle.getImmatriculationProvisoire()
        );
    }

    private String vehicleDescriptor(MouvementVehicule vehicle) {
        return vehicleDescriptor(
                vehicle.getMarque() == null ? null : vehicle.getMarque().getLibelle(),
                vehicle.getImmatriculation(),
                vehicle.getImmatriculationProvisoire()
        );
    }

    private String vehicleDescriptor(String brand, String registration, String provisionalRegistration) {
        String resolvedRegistration = value(registration, provisionalRegistration);
        return Stream.of(brand, resolvedRegistration)
                .filter(Objects::nonNull)
                .filter(item -> !item.isBlank())
                .map(String::trim)
                .reduce((left, right) -> left + " " + right)
                .orElse("");
    }

    private String value(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
