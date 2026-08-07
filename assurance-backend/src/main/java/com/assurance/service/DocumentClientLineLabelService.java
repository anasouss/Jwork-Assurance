package com.assurance.service;

import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.entity.MouvementVehicule;
import com.assurance.entity.Vehicule;
import com.assurance.enums.NatureElementFacturable;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.MouvementVehiculeRepository;
import com.assurance.repository.VehiculeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class DocumentClientLineLabelService {

    private final AssistanceContratRepository assistanceContratRepository;
    private final MouvementVehiculeRepository mouvementVehiculeRepository;
    private final VehiculeRepository vehiculeRepository;

    public String label(LigneDocumentClient line, Integer fleetAnnexNumber) {
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
        Vehicule vehicle = assistance.getVehicule();
        if (vehicle == null) {
            return "Assistance";
        }
        String descriptor = vehicleDescriptor(
                vehicle.getMarque() == null ? null : vehicle.getMarque().getLibelle(),
                vehicle.getImmatriculation(),
                vehicle.getImmatriculationProvisoire()
        );
        return descriptor.isBlank() ? "Assistance" : "Assistance : " + descriptor;
    }

    private String insuranceLabel(LigneDocumentClient line) {
        Long movementId = movementId(line);
        if (movementId != null) {
            String movementVehicle = mouvementVehiculeRepository.findByMouvementContratId(movementId).stream()
                    .findFirst()
                    .map(this::vehicleDescriptor)
                    .orElse("");
            if (!movementVehicle.isBlank()) {
                return "Police automobile : " + movementVehicle;
            }
        }
        if (line.getElementFacturable() != null && line.getElementFacturable().getContrat() != null) {
            return vehiculeRepository.findActiveByContratIdOrderByCreatedAtAsc(
                            line.getElementFacturable().getContrat().getId()
                    ).stream()
                    .findFirst()
                    .map(this::vehicleDescriptor)
                    .filter(value -> !value.isBlank())
                    .map(value -> "Police automobile : " + value)
                    .orElse("Police automobile");
        }
        return "Police automobile";
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
