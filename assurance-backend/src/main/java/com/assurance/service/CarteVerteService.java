package com.assurance.service;

import com.assurance.dto.request.UpsertCarteVerteRequest;
import com.assurance.dto.response.CarteVerteContextResponse;
import com.assurance.dto.response.CarteVerteResponse;
import com.assurance.entity.CarteVerte;
import com.assurance.entity.Contrat;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.MouvementVehicule;
import com.assurance.entity.Vehicule;
import com.assurance.enums.NatureSnapshotMouvement;
import com.assurance.enums.NatureElementFacturable;
import com.assurance.enums.StatutElementFacturable;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.CarteVerteRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.ElementFacturableRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.MouvementVehiculeRepository;
import com.assurance.repository.VehiculeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CarteVerteService {

    private static final String PARAM_MONTANT_CARTE_VERTE = "MONTANT_CARTE_VERTE";

    private final ContratRepository contratRepository;
    private final MouvementContratRepository mouvementContratRepository;
    private final MouvementVehiculeRepository mouvementVehiculeRepository;
    private final VehiculeRepository vehiculeRepository;
    private final CarteVerteRepository carteVerteRepository;
    private final ElementFacturableRepository elementFacturableRepository;
    private final ParametreApplicationService parametreApplicationService;

    @Transactional(readOnly = true)
    public CarteVerteContextResponse getContext(Long agenceId, Long contratId, Long mouvementId) {
        Contrat contrat = resolveContrat(agenceId, contratId);
        MouvementContrat mouvement = resolveMouvement(contrat, mouvementId);
        List<CarteVerte> activeCartes = mouvement == null
                ? carteVerteRepository.findByContratIdAndActifTrueOrderByCreatedAtDesc(contrat.getId())
                : carteVerteRepository.findByMouvementContratIdAndActifTrueOrderByCreatedAtDesc(mouvement.getId());
        Set<Long> vehiculesAvecCarte = activeCartes.stream()
                .filter(carte -> carte.getVehicule() != null)
                .map(carte -> carte.getVehicule().getId())
                .collect(Collectors.toSet());

        return CarteVerteContextResponse.builder()
                .contratId(contrat.getId())
                .numeroDossier(contrat.getNumeroDossier())
                .numeroPolice(contrat.getNumeroPolice())
                .typeContrat(contrat.getTypeContrat())
                .dateEffet(firstNonNull(mouvement != null ? mouvement.getDateEffet() : null, contrat.getDateEffet()))
                .dateEcheance(firstNonNull(mouvement != null ? mouvement.getDateEcheance() : null, contrat.getDateEcheance()))
                .mouvementContratId(mouvement != null ? mouvement.getId() : null)
                .mouvementCode(mouvement != null && mouvement.getTypeMouvement() != null ? mouvement.getTypeMouvement().getCode() : null)
                .mouvementLibelle(mouvement != null && mouvement.getTypeMouvement() != null ? mouvement.getTypeMouvement().getLibelle() : "Contrat")
                .montant(resolveMontant(agenceId))
                .vehiculesEligibles(resolveVehiculesCibles(contrat, mouvement).stream()
                        .filter(vehicule -> Boolean.TRUE.equals(vehicule.getActif()))
                        .filter(vehicule -> !vehiculesAvecCarte.contains(vehicule.getId()))
                        .map(this::toVehiculeOption)
                        .toList())
                .cartesVertes(activeCartes.stream().map(this::toResponse).toList())
                .build();
    }

    @Transactional
    public CarteVerteResponse upsert(Long agenceId, Long contratId, UpsertCarteVerteRequest request) {
        Contrat contrat = resolveContrat(agenceId, contratId);
        Vehicule vehicule = vehiculeRepository.findById(request.getVehiculeId())
                .orElseThrow(() -> new ResourceNotFoundException("Vehicule", request.getVehiculeId()));
        if (vehicule.getContrat() == null || !vehicule.getContrat().getId().equals(contrat.getId())) {
            throw new BadRequestException("Le vehicule ne correspond pas au contrat");
        }
        MouvementContrat mouvement = resolveMouvement(contrat, request.getMouvementContratId());
        validateVehiculeCible(contrat, mouvement, vehicule);
        LocalDate dateEffet = firstNonNull(request.getDateEffet(), mouvement != null ? mouvement.getDateEffet() : null, vehicule.getDateEffet(), contrat.getDateEffet(), LocalDate.now());
        LocalDate dateEcheance = firstNonNull(mouvement != null ? mouvement.getDateEcheance() : null, vehicule.getDateEcheance(), contrat.getDateEcheance(), dateEffet);
        BigDecimal montant = resolveMontant(agenceId);

        CarteVerte carte = carteVerteRepository
                .findFirstByContratIdAndVehiculeIdAndActifTrueOrderByCreatedAtDesc(contrat.getId(), vehicule.getId())
                .orElse(null);
        if (carte != null
                && mouvement != null
                && (carte.getMouvementContrat() == null
                    || !mouvement.getId().equals(carte.getMouvementContrat().getId()))) {
            carte.setActif(false);
            if (carte.getElementFacturable() != null) {
                carte.getElementFacturable().setActif(false);
                elementFacturableRepository.save(carte.getElementFacturable());
            }
            carteVerteRepository.save(carte);
            carte = null;
        }
        if (carte == null) {
            carte = new CarteVerte();
        }
        carte.setContrat(contrat);
        carte.setMouvementContrat(mouvement);
        carte.setVehicule(vehicule);
        carte.setCompagnieAssurance(contrat.getCompagnieAssurance());
        carte.setNumero(request.getNumero().trim());
        carte.setDateEffet(dateEffet);
        carte.setDateEcheance(dateEcheance);
        carte.setDateCreation(LocalDate.now());
        carte.setImmatriculation(vehicule.getImmatriculation());
        carte.setMarque(vehicule.getMarque() != null ? vehicule.getMarque().getLibelle() : null);
        carte.setNumeroDossier(contrat.getNumeroDossier());
        carte.setNumeroPoliceContrat(contrat.getNumeroPolice());
        carte.setProduit("Carte verte");
        carte.setTypeQuittance("CARTE_VERTE");
        carte.setDuree(null);
        carte.setUnite(null);
        carte.setMontant(montant);
        carte.setActif(true);
        carte = carteVerteRepository.save(carte);

        ElementFacturable element = carte.getElementFacturable();
        if (element == null) {
            element = new ElementFacturable();
        }
        element.setAgence(contrat.getAgence());
        element.setContrat(contrat);
        element.setMouvementContrat(mouvement);
        element.setCompagnieAssurance(contrat.getCompagnieAssurance());
        element.setNature(NatureElementFacturable.CARTE_VERTE);
        element.setStatut(StatutElementFacturable.A_QUITTANCER);
        element.setReferenceSource(String.valueOf(carte.getId()));
        element.setLibelle("Carte verte - " + firstNonBlank(vehicule.getImmatriculation(), carte.getNumero()));
        element.setDateDebut(dateEffet);
        element.setDateFin(dateEcheance);
        element.setPrimeNette(montant);
        element.setTaxe(BigDecimal.ZERO);
        element.setTaxeParafiscale(BigDecimal.ZERO);
        element.setAccessoire(BigDecimal.ZERO);
        element.setCnpac(BigDecimal.ZERO);
        element.setPrimeTotale(montant);
        element.setActif(true);
        element = elementFacturableRepository.save(element);
        carte.setElementFacturable(element);
        carte = carteVerteRepository.save(carte);

        return toResponse(carte);
    }

    @Transactional
    public void deactivate(Long agenceId, Long contratId, Long carteVerteId) {
        Contrat contrat = resolveContrat(agenceId, contratId);
        CarteVerte carte = carteVerteRepository.findById(carteVerteId)
                .orElseThrow(() -> new ResourceNotFoundException("CarteVerte", carteVerteId));
        if (carte.getContrat() == null || !carte.getContrat().getId().equals(contrat.getId())) {
            throw new BadRequestException("La carte verte ne correspond pas au contrat");
        }
        carte.setActif(false);
        if (carte.getElementFacturable() != null) {
            carte.getElementFacturable().setActif(false);
            elementFacturableRepository.save(carte.getElementFacturable());
        }
        carteVerteRepository.save(carte);
    }

    private Contrat resolveContrat(Long agenceId, Long contratId) {
        return contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
    }

    private MouvementContrat resolveMouvement(Contrat contrat, Long mouvementId) {
        if (mouvementId == null) {
            return null;
        }
        MouvementContrat mouvement = mouvementContratRepository.findById(mouvementId)
                .orElseThrow(() -> new ResourceNotFoundException("MouvementContrat", mouvementId));
        if (mouvement.getContrat() == null || !mouvement.getContrat().getId().equals(contrat.getId())) {
            throw new BadRequestException("Le mouvement ne correspond pas au contrat");
        }
        return mouvement;
    }

    private List<Vehicule> resolveVehiculesCibles(Contrat contrat, MouvementContrat mouvement) {
        if (mouvement == null) {
            return vehiculeRepository.findByContratIdOrderByCreatedAtAsc(contrat.getId());
        }
        Map<Long, Vehicule> vehicules = new LinkedHashMap<>();
        for (MouvementVehicule snapshot : mouvementVehiculeRepository.findByMouvementContratId(mouvement.getId())) {
            if (snapshot.getVehicule() != null && isEtatApresMouvement(snapshot.getNature())) {
                vehicules.putIfAbsent(snapshot.getVehicule().getId(), snapshot.getVehicule());
            }
        }
        return List.copyOf(vehicules.values());
    }

    private void validateVehiculeCible(Contrat contrat, MouvementContrat mouvement, Vehicule vehicule) {
        if (mouvement == null) {
            return;
        }
        boolean cibleDuMouvement = resolveVehiculesCibles(contrat, mouvement).stream()
                .anyMatch(cible -> cible.getId().equals(vehicule.getId())
                        && Boolean.TRUE.equals(cible.getActif()));
        if (!cibleDuMouvement) {
            throw new BadRequestException("Le véhicule ne correspond pas aux cibles actives du mouvement");
        }
    }

    private boolean isEtatApresMouvement(NatureSnapshotMouvement nature) {
        return nature == NatureSnapshotMouvement.AJOUT
                || nature == NatureSnapshotMouvement.APRES
                || nature == NatureSnapshotMouvement.COURANT;
    }

    private BigDecimal resolveMontant(Long agenceId) {
        return parametreApplicationService.getDecimal(agenceId, PARAM_MONTANT_CARTE_VERTE, BigDecimal.valueOf(500)).max(BigDecimal.ZERO);
    }

    private CarteVerteContextResponse.VehiculeCarteVerteOption toVehiculeOption(Vehicule vehicule) {
        return CarteVerteContextResponse.VehiculeCarteVerteOption.builder()
                .id(vehicule.getId())
                .immatriculation(vehicule.getImmatriculation())
                .usageCode(vehicule.getUsage() != null ? vehicule.getUsage().getCode() : null)
                .usageLibelle(vehicule.getUsage() != null ? vehicule.getUsage().getLibelle() : null)
                .dateEffet(vehicule.getDateEffet())
                .dateEcheance(vehicule.getDateEcheance())
                .build();
    }

    private CarteVerteResponse toResponse(CarteVerte carte) {
        return CarteVerteResponse.builder()
                .id(carte.getId())
                .contratId(carte.getContrat() != null ? carte.getContrat().getId() : null)
                .mouvementContratId(carte.getMouvementContrat() != null ? carte.getMouvementContrat().getId() : null)
                .vehiculeId(carte.getVehicule() != null ? carte.getVehicule().getId() : null)
                .vehiculeImmatriculation(firstNonBlank(carte.getImmatriculation(), carte.getVehicule() != null ? carte.getVehicule().getImmatriculation() : null))
                .numero(carte.getNumero())
                .dateEffet(carte.getDateEffet())
                .dateEcheance(carte.getDateEcheance())
                .numeroPoliceContrat(carte.getNumeroPoliceContrat())
                .numeroDossier(carte.getNumeroDossier())
                .montant(carte.getMontant())
                .elementFacturableId(carte.getElementFacturable() != null ? carte.getElementFacturable().getId() : null)
                .build();
    }

    @SafeVarargs
    private static <T> T firstNonNull(T... values) {
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }
}
