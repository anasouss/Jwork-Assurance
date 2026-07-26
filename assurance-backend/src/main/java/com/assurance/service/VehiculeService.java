package com.assurance.service;

import com.assurance.dto.response.ContratResponse;
import com.assurance.entity.Vehicule;
import com.assurance.repository.VehiculeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class VehiculeService {

    private final VehiculeRepository vehiculeRepository;

    @Transactional(readOnly = true)
    public Optional<ContratResponse.VehiculeView> searchByImmatriculation(Long agenceId, String immatriculation) {
        if (agenceId == null || immatriculation == null || immatriculation.trim().isEmpty()) {
            return Optional.empty();
        }
        return vehiculeRepository
                .findFirstByContratAgenceIdAndImmatriculationIgnoreCaseOrderByCreatedAtDesc(agenceId, immatriculation.trim())
                .map(this::toView);
    }

    private ContratResponse.VehiculeView toView(Vehicule vehicule) {
        return ContratResponse.VehiculeView.builder()
                .vehiculeId(vehicule.getId())
                .typeVehicule(vehicule.getTypeVehicule() != null ? vehicule.getTypeVehicule().name() : null)
                .usageId(vehicule.getUsage() != null ? vehicule.getUsage().getId() : null)
                .usageCode(vehicule.getUsage() != null ? vehicule.getUsage().getCode() : null)
                .usageLibelle(vehicule.getUsage() != null ? vehicule.getUsage().getLibelle() : null)
                .groupeUsageAttestationCode(vehicule.getUsage() != null && vehicule.getUsage().getGroupeUsageAttestation() != null ? vehicule.getUsage().getGroupeUsageAttestation().getCode() : null)
                .consommeAttestation(vehicule.getUsage() != null ? vehicule.getUsage().getConsommeAttestation() : null)
                .immatriculation(vehicule.getImmatriculation())
                .remorque(vehicule.getRemorque())
                .marqueId(vehicule.getMarque() != null ? vehicule.getMarque().getId() : null)
                .marque(vehicule.getMarque() != null ? vehicule.getMarque().getLibelle() : null)
                .carrosserieId(vehicule.getCarrosserie() != null ? vehicule.getCarrosserie().getId() : null)
                .carrosserie(vehicule.getCarrosserie() != null ? vehicule.getCarrosserie().getLibelle() : null)
                .categorieTransportId(vehicule.getCategorieTransport() != null ? vehicule.getCategorieTransport().getId() : null)
                .categorieTransportCode(vehicule.getCategorieTransport() != null ? vehicule.getCategorieTransport().getCode() : null)
                .categorieTransportLibelle(vehicule.getCategorieTransport() != null ? vehicule.getCategorieTransport().getLibelle() : null)
                .carburant(vehicule.getCarburant())
                .puissanceFiscale(vehicule.getPuissanceFiscale())
                .nombrePlaces(vehicule.getNombrePlaces())
                .sousClasse(vehicule.getSousClasse())
                .ptc(vehicule.getPtc())
                .datePremiereCirculation(vehicule.getDatePremiereCirculation())
                .dateExpirationCarteGrise(vehicule.getDateExpirationCarteGrise())
                .dateEffet(vehicule.getDateEffet())
                .dateEcheance(vehicule.getDateEcheance())
                .crm(vehicule.getCrm())
                .coefficientProrata(vehicule.getCoefficientProrata())
                .valeurVenale(vehicule.getValeurVenale())
                .valeurNeuf(vehicule.getValeurNeuf())
                .valeurGlace(vehicule.getValeurGlace())
                .organismeCredit(vehicule.getOrganismeCredit())
                .nomOrganismeCredit(vehicule.getNomOrganismeCredit())
                .montantCredit(vehicule.getMontantCredit())
                .dateFinCredit(vehicule.getDateFinCredit())
                .build();
    }
}
