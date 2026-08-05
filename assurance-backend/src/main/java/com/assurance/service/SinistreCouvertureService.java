package com.assurance.service;

import com.assurance.dto.response.SinistreCouverturePreviewResponse;
import com.assurance.entity.Client;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.MouvementGarantie;
import com.assurance.entity.MouvementVehicule;
import com.assurance.entity.Vehicule;
import com.assurance.enums.NatureSnapshotMouvement;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.MouvementGarantieRepository;
import com.assurance.repository.MouvementVehiculeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class SinistreCouvertureService {

    private final ContratRepository contratRepository;
    private final ContratClientRepository contratClientRepository;
    private final MouvementContratRepository mouvementContratRepository;
    private final MouvementVehiculeRepository mouvementVehiculeRepository;
    private final MouvementGarantieRepository mouvementGarantieRepository;

    @Transactional(readOnly = true)
    public SinistreCouverturePreviewResponse preview(
            Long agenceId,
            Long contratId,
            LocalDate dateSinistre
    ) {
        return toPreview(resolveState(agenceId, contratId, dateSinistre));
    }

    @Transactional(readOnly = true)
    public CouvertureResolue resolve(
            Long agenceId,
            Long contratId,
            Long vehiculeId,
            LocalDate dateSinistre
    ) {
        EtatCouverture state = resolveState(agenceId, contratId, dateSinistre);
        MouvementVehicule vehicule = resolveVehicule(state.vehicules(), vehiculeId);
        List<MouvementGarantie> garanties = state.garanties().stream()
                .filter(snapshot -> snapshot.getVehicule() == null
                        || Objects.equals(snapshot.getVehicule().getId(), vehicule.getVehicule().getId()))
                .toList();
        if (garanties.isEmpty()) {
            throw new BadRequestException(
                    "Aucune garantie couverte n'a été trouvée pour ce véhicule à la date du sinistre"
            );
        }

        return new CouvertureResolue(
                state.contrat(),
                state.mouvement(),
                state.assure(),
                vehicule.getVehicule(),
                vehicule,
                garanties,
                List.copyOf(state.vehicules().values())
        );
    }

    private EtatCouverture resolveState(
            Long agenceId,
            Long contratId,
            LocalDate dateSinistre
    ) {
        if (dateSinistre == null) {
            throw new BadRequestException("La date du sinistre est obligatoire");
        }
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        validateContract(contrat, dateSinistre);

        List<MouvementContrat> mouvements = mouvementsCouverts(contrat, dateSinistre);
        if (mouvements.isEmpty()) {
            throw new BadRequestException(
                    "Aucun mouvement contractuel valide ne couvre la date du sinistre"
            );
        }
        Map<Long, MouvementVehicule> vehicules = replayVehicules(mouvements);
        if (vehicules.isEmpty()) {
            throw new BadRequestException(
                    "Aucun véhicule couvert n'a été trouvé à la date du sinistre"
            );
        }
        return new EtatCouverture(
                contrat,
                mouvements.get(mouvements.size() - 1),
                resolveAssure(contrat),
                vehicules,
                replayGaranties(mouvements)
        );
    }

    private void validateContract(Contrat contrat, LocalDate dateSinistre) {
        if (Boolean.TRUE.equals(contrat.getBrouillon()) || Boolean.TRUE.equals(contrat.getProspection())) {
            throw new BadRequestException("Un sinistre ne peut pas être déclaré sur un brouillon ou une prospection");
        }
        if (contrat.getDateEffet() == null || contrat.getDateEcheance() == null) {
            throw new BadRequestException("La période de couverture du contrat est incomplète");
        }
        if (dateSinistre.isBefore(contrat.getDateEffet()) || dateSinistre.isAfter(contrat.getDateEcheance())) {
            throw new BadRequestException("La date du sinistre est hors de la période de couverture du contrat");
        }
        if (contrat.getCompagnieAssurance() == null) {
            throw new BadRequestException("La compagnie du contrat est absente");
        }
    }

    private List<MouvementContrat> mouvementsCouverts(Contrat contrat, LocalDate dateSinistre) {
        return mouvementContratRepository.findByContratIdOrderByCreatedAtDesc(contrat.getId()).stream()
                .filter(mouvement -> mouvement.getStatut() == StatutMouvementContrat.VALIDE)
                .filter(mouvement -> mouvement.getDateEffet() != null)
                .filter(mouvement -> !mouvement.getDateEffet().isAfter(dateSinistre))
                .sorted(Comparator.comparing(MouvementContrat::getDateEffet)
                        .thenComparingInt(this::movementNumber)
                        .thenComparing(MouvementContrat::getId))
                .toList();
    }

    private Map<Long, MouvementVehicule> replayVehicules(List<MouvementContrat> mouvements) {
        Map<Long, MouvementVehicule> state = new LinkedHashMap<>();
        for (MouvementContrat mouvement : mouvements) {
            List<MouvementVehicule> snapshots = mouvementVehiculeRepository
                    .findByMouvementContratId(mouvement.getId());
            Map<Long, MouvementVehicule> apres = byVehicule(snapshots, NatureSnapshotMouvement.APRES);
            if (!apres.isEmpty()) {
                snapshots.stream()
                        .filter(snapshot -> snapshot.getNature() == NatureSnapshotMouvement.AVANT)
                        .map(MouvementVehicule::getVehicule)
                        .filter(Objects::nonNull)
                        .map(Vehicule::getId)
                        .filter(id -> !apres.containsKey(id))
                        .forEach(state::remove);
                state.putAll(apres);
            }
            snapshots.stream()
                    .filter(snapshot -> snapshot.getVehicule() != null)
                    .filter(snapshot -> snapshot.getNature() != NatureSnapshotMouvement.AVANT)
                    .filter(snapshot -> snapshot.getNature() != NatureSnapshotMouvement.APRES)
                    .forEach(snapshot -> applyVehicleSnapshot(state, snapshot));
        }
        return state;
    }

    private Map<Long, MouvementVehicule> byVehicule(
            List<MouvementVehicule> snapshots,
            NatureSnapshotMouvement nature
    ) {
        Map<Long, MouvementVehicule> result = new LinkedHashMap<>();
        snapshots.stream()
                .filter(snapshot -> snapshot.getNature() == nature)
                .filter(snapshot -> snapshot.getVehicule() != null)
                .forEach(snapshot -> result.put(snapshot.getVehicule().getId(), snapshot));
        return result;
    }

    private void applyVehicleSnapshot(Map<Long, MouvementVehicule> state, MouvementVehicule snapshot) {
        Long id = snapshot.getVehicule().getId();
        if (snapshot.getNature() == NatureSnapshotMouvement.RETRAIT) {
            state.remove(id);
        } else if (snapshot.getNature() == NatureSnapshotMouvement.AJOUT
                || snapshot.getNature() == NatureSnapshotMouvement.COURANT) {
            state.put(id, snapshot);
        }
    }

    private MouvementVehicule resolveVehicule(
            Map<Long, MouvementVehicule> vehicules,
            Long vehiculeId
    ) {
        if (vehiculeId != null) {
            MouvementVehicule snapshot = vehicules.get(vehiculeId);
            if (snapshot == null) {
                throw new BadRequestException("Ce véhicule n'était pas couvert à la date du sinistre");
            }
            return snapshot;
        }
        if (vehicules.size() > 1) {
            throw new BadRequestException("Le véhicule concerné est obligatoire pour ce contrat");
        }
        return vehicules.values().iterator().next();
    }

    private List<MouvementGarantie> replayGaranties(List<MouvementContrat> mouvements) {
        Map<GarantieKey, MouvementGarantie> state = new LinkedHashMap<>();
        for (MouvementContrat mouvement : mouvements) {
            List<MouvementGarantie> snapshots = mouvementGarantieRepository
                    .findByMouvementContratId(mouvement.getId());
            Map<GarantieKey, MouvementGarantie> apres = byGarantie(snapshots, NatureSnapshotMouvement.APRES);
            if (!apres.isEmpty()) {
                snapshots.stream()
                        .filter(snapshot -> snapshot.getNature() == NatureSnapshotMouvement.AVANT)
                        .map(this::garantieKey)
                        .filter(Objects::nonNull)
                        .filter(key -> !apres.containsKey(key))
                        .forEach(state::remove);
                state.putAll(apres);
            }
            snapshots.stream()
                    .filter(snapshot -> snapshot.getNature() != NatureSnapshotMouvement.AVANT)
                    .filter(snapshot -> snapshot.getNature() != NatureSnapshotMouvement.APRES)
                    .forEach(snapshot -> applyGuaranteeSnapshot(state, snapshot));
        }
        return state.values().stream()
                .sorted(Comparator.comparing(snapshot -> snapshot.getGarantie().getCode()))
                .toList();
    }

    private Map<GarantieKey, MouvementGarantie> byGarantie(
            List<MouvementGarantie> snapshots,
            NatureSnapshotMouvement nature
    ) {
        Map<GarantieKey, MouvementGarantie> result = new LinkedHashMap<>();
        snapshots.stream()
                .filter(snapshot -> snapshot.getNature() == nature)
                .forEach(snapshot -> {
                    GarantieKey key = garantieKey(snapshot);
                    if (key != null) {
                        result.put(key, snapshot);
                    }
                });
        return result;
    }

    private void applyGuaranteeSnapshot(
            Map<GarantieKey, MouvementGarantie> state,
            MouvementGarantie snapshot
    ) {
        GarantieKey key = garantieKey(snapshot);
        if (key == null || snapshot.getNature() == NatureSnapshotMouvement.DIFFERENTIEL) {
            return;
        }
        if (snapshot.getNature() == NatureSnapshotMouvement.RETRAIT) {
            state.remove(key);
        } else if (snapshot.getNature() == NatureSnapshotMouvement.AJOUT
                || snapshot.getNature() == NatureSnapshotMouvement.COURANT) {
            state.put(key, snapshot);
        }
    }

    private GarantieKey garantieKey(MouvementGarantie snapshot) {
        if (snapshot.getGarantie() == null) {
            return null;
        }
        return new GarantieKey(
                snapshot.getGarantie().getId(),
                snapshot.getVehicule() == null ? null : snapshot.getVehicule().getId(),
                snapshot.getRemorque() == null ? null : snapshot.getRemorque().getId(),
                snapshot.getClient() == null ? null : snapshot.getClient().getId()
        );
    }

    private Client resolveAssure(Contrat contrat) {
        List<ContratClient> clients = contratClientRepository.findByContratIdIn(List.of(contrat.getId()));
        return clients.stream()
                .sorted(Comparator.comparingInt(this::rolePriority)
                        .thenComparing(item -> Boolean.TRUE.equals(item.getPrincipalPourRole()) ? 0 : 1))
                .map(ContratClient::getClient)
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Aucun assuré n'est rattaché au contrat"));
    }

    private int rolePriority(ContratClient item) {
        if (item.getRole() == RoleClientContrat.PROPRIETAIRE) {
            return 0;
        }
        if (item.getRole() == RoleClientContrat.SOUSCRIPTEUR) {
            return 1;
        }
        return 2;
    }

    private int movementNumber(MouvementContrat mouvement) {
        try {
            return Integer.parseInt(mouvement.getNumeroMouvement());
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private SinistreCouverturePreviewResponse toPreview(EtatCouverture couverture) {
        List<SinistreCouverturePreviewResponse.Vehicule> vehicules = couverture.vehicules().values().stream()
                .map(snapshot -> toVehiclePreview(snapshot, couverture.garanties().stream()
                        .filter(garantie -> garantie.getVehicule() == null
                                || Objects.equals(
                                        garantie.getVehicule().getId(),
                                        snapshot.getVehicule().getId()
                                ))
                        .toList()))
                .toList();
        return SinistreCouverturePreviewResponse.builder()
                .contratId(couverture.contrat().getId())
                .numeroDossier(couverture.contrat().getNumeroDossier())
                .numeroPolice(couverture.contrat().getNumeroPolice())
                .compagnie(couverture.contrat().getCompagnieAssurance().getNom())
                .assure(couverture.assure().getNomAffichage())
                .mouvementId(couverture.mouvement().getId())
                .numeroMouvement(couverture.mouvement().getNumeroMouvement())
                .mouvement(couverture.mouvement().getTypeMouvement().getLibelle())
                .dateEffet(couverture.mouvement().getDateEffet())
                .dateEcheance(couverture.mouvement().getDateEcheance())
                .vehicules(vehicules)
                .build();
    }

    private SinistreCouverturePreviewResponse.Vehicule toVehiclePreview(
            MouvementVehicule snapshot,
            List<MouvementGarantie> garanties
    ) {
        return SinistreCouverturePreviewResponse.Vehicule.builder()
                .id(snapshot.getVehicule().getId())
                .immatriculation(snapshot.getImmatriculation())
                .numeroAttestation(snapshot.getNumeroAttestation())
                .marque(snapshot.getMarque() == null ? null : snapshot.getMarque().getLibelle())
                .usageCode(snapshot.getUsage() == null ? null : snapshot.getUsage().getCode())
                .usageLibelle(snapshot.getUsage() == null ? null : snapshot.getUsage().getLibelle())
                .garanties(garanties.stream().map(this::toGuaranteePreview).toList())
                .build();
    }

    private SinistreCouverturePreviewResponse.Garantie toGuaranteePreview(MouvementGarantie snapshot) {
        return SinistreCouverturePreviewResponse.Garantie.builder()
                .id(snapshot.getGarantie().getId())
                .mouvementGarantieId(snapshot.getId())
                .code(snapshot.getGarantie().getCode())
                .libelle(snapshot.getGarantie().getLibelle())
                .capital(snapshot.getCapital())
                .prime(snapshot.getPrime())
                .taux(snapshot.getTaux())
                .tauxFranchise(snapshot.getTauxFranchise())
                .franchiseMinimale(snapshot.getFranchiseMinimale())
                .build();
    }

    public record CouvertureResolue(
            Contrat contrat,
            MouvementContrat mouvement,
            Client assure,
            Vehicule vehicule,
            MouvementVehicule vehiculeSnapshot,
            List<MouvementGarantie> garanties,
            List<MouvementVehicule> vehiculesCouverts
    ) {
    }

    private record EtatCouverture(
            Contrat contrat,
            MouvementContrat mouvement,
            Client assure,
            Map<Long, MouvementVehicule> vehicules,
            List<MouvementGarantie> garanties
    ) {
    }

    private record GarantieKey(
            Long garantieId,
            Long vehiculeId,
            Long remorqueId,
            Long clientId
    ) {
    }
}
