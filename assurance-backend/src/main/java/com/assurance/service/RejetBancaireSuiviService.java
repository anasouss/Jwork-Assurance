package com.assurance.service;

import com.assurance.dto.request.AjouterMouvementRejetRequest;
import com.assurance.dto.response.SuiviRejetBancaireResponse;
import com.assurance.entity.Client;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.LigneBordereauRemise;
import com.assurance.entity.MouvementRejetBancaire;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.StatutLigneBordereauRemise;
import com.assurance.enums.StatutReglementClient;
import com.assurance.enums.StatutSuiviRejetBancaire;
import com.assurance.enums.TypeMouvementRejetBancaire;
import com.assurance.enums.TypeClient;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.InstrumentReglementClientRepository;
import com.assurance.repository.LigneBordereauRemiseRepository;
import com.assurance.repository.MouvementRejetBancaireRepository;
import com.assurance.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class RejetBancaireSuiviService {
    private final InstrumentReglementClientRepository instruments;
    private final LigneBordereauRemiseRepository remises;
    private final MouvementRejetBancaireRepository mouvements;

    public StatutSuiviRejetBancaire statut(InstrumentReglementClient instrument) {
        if (contreValeurSoldee(instrument)) return StatutSuiviRejetBancaire.REGLE_CV;
        if (instrument.getSuiviRejet() == StatutSuiviRejetBancaire.CONTENTIEUX
                && instrument.getStatut() != StatutInstrumentReglement.CONFIRME) {
            return StatutSuiviRejetBancaire.CONTENTIEUX;
        }
        if (instrument.getStatut() == StatutInstrumentReglement.REMIS_EN_BANQUE
                || instrument.getStatut() == StatutInstrumentReglement.CONFIRME) {
            return StatutSuiviRejetBancaire.REPRESENTE;
        }
        return StatutSuiviRejetBancaire.INSTANCE;
    }

    private boolean contreValeurSoldee(InstrumentReglementClient instrument) {
        return instrument.getReglement().getStatut() == StatutReglementClient.VALIDE
                && instrument.getStatut() == StatutInstrumentReglement.REMPLACE
                && money(instrument.getMontant()).signum() > 0
                && encaisse(instrument, new HashSet<>()).compareTo(instrument.getMontant()) >= 0;
    }

    private BigDecimal encaisse(InstrumentReglementClient instrument, Set<Long> visited) {
        if (!visited.add(instrument.getId())) return BigDecimal.ZERO;
        if (instrument.getStatut() == StatutInstrumentReglement.CONFIRME) return money(instrument.getMontant());
        if (instrument.getStatut() != StatutInstrumentReglement.REMPLACE) return BigDecimal.ZERO;
        return enfants(instrument).stream().map(child -> encaisse(child, visited)).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private List<InstrumentReglementClient> enfants(InstrumentReglementClient instrument) {
        return instrument.getReglement().getInstruments().stream()
                .filter(child -> child.getInstrumentRemplace() != null
                        && Objects.equals(child.getInstrumentRemplace().getId(), instrument.getId())
                        && Objects.equals(child.getAgence().getId(), instrument.getAgence().getId()))
                .toList();
    }

    private List<StatutSuiviRejetBancaire> statutsAutorises(InstrumentReglementClient instrument) {
        if (instrument.getReglement().getStatut() != StatutReglementClient.VALIDE) return List.of();
        if (contreValeurSoldee(instrument)) return List.of(StatutSuiviRejetBancaire.REGLE_CV);
        if (instrument.getStatut() == StatutInstrumentReglement.CONFIRME) return List.of(StatutSuiviRejetBancaire.REPRESENTE);
        if (instrument.getStatut() == StatutInstrumentReglement.REMIS_EN_BANQUE) {
            return List.of(StatutSuiviRejetBancaire.REPRESENTE, StatutSuiviRejetBancaire.CONTENTIEUX);
        }
        return List.of(StatutSuiviRejetBancaire.INSTANCE, StatutSuiviRejetBancaire.CONTENTIEUX);
    }

    @Transactional(readOnly = true)
    public SuiviRejetBancaireResponse detail(Long agenceId, Long instrumentId) {
        InstrumentReglementClient instrument = find(agenceId, instrumentId, false);
        List<LigneBordereauRemise> history = remises.findHistoryByAgenceIdAndInstrumentId(agenceId, instrumentId);
        requireRejet(instrument, history);
        List<SuiviRejetBancaireResponse.Mouvement> events = new ArrayList<>(mouvements
                .findByAgenceIdAndInstrumentIdOrderByDateOperationAscIdAsc(agenceId, instrumentId).stream()
                .map(event -> new SuiviRejetBancaireResponse.Mouvement(event.getId().toString(), event.getDateOperation(),
                        event.getCreatedAt(), event.getType(), event.getStatutSuivi(), event.getMotif(), event.getUtilisateurNom(),
                        event.getInstrumentSource() == null ? null : event.getInstrumentSource().getId())).toList());
        // Legacy rejections remain visible without creating events during a read.
        for (LigneBordereauRemise line : history) {
            if (line.getStatut() == StatutLigneBordereauRemise.REJETEE) {
                addLegacyRejet(events, "bordereau-" + line.getId(), line.getDateTraitement(), line.getMotifRejet(), instrumentId);
            }
        }
        addLegacyRejet(events, "instrument-" + instrumentId,
                instrument.getDateRejet() != null ? instrument.getDateRejet()
                        : instrument.getStatut() == StatutInstrumentReglement.REJETE ? instrument.getDateStatut() : null,
                instrument.getMotifRejet() != null ? instrument.getMotifRejet() : instrument.getMotifStatut(), instrumentId);
        events.sort(Comparator.comparing(SuiviRejetBancaireResponse.Mouvement::date,
                Comparator.nullsFirst(Comparator.naturalOrder())).thenComparing(
                        SuiviRejetBancaireResponse.Mouvement::enregistreLe, Comparator.nullsFirst(Comparator.naturalOrder())));
        List<InstrumentReglementClient> replacements = new ArrayList<>();
        collectReplacements(instrument, new HashSet<>(), replacements);
        Stream<LocalDate> operationDates = Stream.concat(Stream.of(instrument.getDateStatut()),
                replacements.stream().map(InstrumentReglementClient::getDateStatut));
        operationDates = Stream.concat(operationDates, history.stream()
                .flatMap(line -> Stream.of(line.getBordereau().getDateDepot(), line.getDateTraitement())));
        LocalDate minimumDate = Stream.concat(events.stream().map(SuiviRejetBancaireResponse.Mouvement::date), operationDates)
                .filter(Objects::nonNull).max(LocalDate::compareTo).orElse(null);
        return new SuiviRejetBancaireResponse(instrumentId, instrument.getReglement().getId(), instrument.getReglement().getNumero(),
                instrument.getReglement().getPayeurNom(), instrument.getReglement().getDateReglement(),
                instrument.getDateRejet() != null ? instrument.getDateRejet() : latestRejetDate(history),
                instrument.getMotifRejet() != null ? instrument.getMotifRejet() : latestRejetReason(history),
                instrument.getBanqueEmettriceReference() == null ? null : instrument.getBanqueEmettriceReference().getLibelle(),
                instrument.getStatut(), statut(instrument), instrument.getMontant(),
                instrument.getStatut() == StatutInstrumentReglement.REMPLACE ? encaisse(instrument, new HashSet<>()) : BigDecimal.ZERO,
                instrument.getReglement().getStatut() != StatutReglementClient.VALIDE, minimumDate,
                statutsAutorises(instrument), events,
                history.stream().map(line -> new SuiviRejetBancaireResponse.Remise(line.getBordereau().getId(),
                        line.getBordereau().getNumero(), line.getBordereau().getDateDepot(), line.getDateTraitement(),
                        line.getStatut().name(), line.getMotifRejet())).toList(),
                replacements.stream().map(child -> new SuiviRejetBancaireResponse.ContreValeur(child.getId(), child.getMode(),
                        child.getReferenceInstrument(), child.getMontant(), child.getStatut(), child.getInstrumentRemplace().getId())).toList());
    }

    @Transactional
    public void ajouter(Long agenceId, Long instrumentId, AjouterMouvementRejetRequest request) {
        InstrumentReglementClient instrument = find(agenceId, instrumentId, true);
        SuiviRejetBancaireResponse current = detail(agenceId, instrumentId);
        if (!current.statutsAutorises().contains(request.getStatut())) {
            throw new BadRequestException("Ce statut n'est pas compatible avec les remises et encaissements enregistrés");
        }
        LocalDate last = current.dateMinimumMouvement();
        if (request.getDateOperation() == null || request.getDateOperation().isAfter(LocalDate.now())
                || last != null && request.getDateOperation().isBefore(last)) {
            throw new BadRequestException("La date doit être comprise entre le dernier mouvement et aujourd'hui");
        }
        if (request.getMotif() == null || request.getMotif().isBlank() || request.getMotif().trim().length() > 500) {
            throw new BadRequestException("Un motif de 1 à 500 caractères est obligatoire");
        }
        instrument.setSuiviRejet(request.getStatut());
        instruments.save(instrument);
        enregistrer(instrument, instrument, TypeMouvementRejetBancaire.SUIVI, request.getDateOperation(), request.getMotif().trim());
    }

    @Transactional
    public void suivreOperation(InstrumentReglementClient source, TypeMouvementRejetBancaire type, LocalDate date, String motif) {
        InstrumentReglementClient current = source;
        Set<Long> visited = new HashSet<>();
        while (current != null && visited.add(current.getId())
                && Objects.equals(current.getAgence().getId(), source.getAgence().getId())
                && Objects.equals(current.getReglement().getId(), source.getReglement().getId())) {
            if (current.getDateRejet() != null || current.getStatut() == StatutInstrumentReglement.REJETE
                    || !remises.findRejectionsByAgenceIdAndInstrumentIds(current.getAgence().getId(), List.of(current.getId())).isEmpty()) {
                enregistrer(current, source, type, date, motif == null || motif.isBlank() ? type.name() : motif.trim());
            }
            current = current.getInstrumentRemplace();
        }
    }

    private void enregistrer(InstrumentReglementClient instrument, InstrumentReglementClient source,
                             TypeMouvementRejetBancaire type, LocalDate date, String motif) {
        MouvementRejetBancaire event = new MouvementRejetBancaire();
        event.setAgence(instrument.getAgence());
        event.setInstrument(instrument);
        event.setInstrumentSource(source);
        event.setDateOperation(date);
        event.setType(type);
        event.setStatutSuivi(statut(instrument));
        event.setMotif(motif);
        event.setUtilisateurId(TenantContext.getCurrentUser());
        event.setUtilisateurNom(TenantContext.getCurrentUsername());
        mouvements.save(event);
    }

    @Transactional(readOnly = true)
    public SuiviRejetBancaireResponse.FichePayeur fichePayeur(Long agenceId, Long instrumentId) {
        InstrumentReglementClient instrument = find(agenceId, instrumentId, false);
        requireRejet(instrument, remises.findHistoryByAgenceIdAndInstrumentId(agenceId, instrumentId));
        Map<Long, Client> clients = new LinkedHashMap<>();
        if (instrument.getReglement().getClientPayeur() != null) {
            Client client = instrument.getReglement().getClientPayeur();
            clients.put(client.getId(), client);
        }
        if (instrument.getReglement().getGroupePayeur() != null) {
            Client treasury = instrument.getReglement().getGroupePayeur().getClientTresorerie();
            if (treasury != null) clients.put(treasury.getId(), treasury);
        }
        instrument.getAffectations().forEach(allocation -> {
            if (allocation.getClientPayeur() != null) clients.put(allocation.getClientPayeur().getId(), allocation.getClientPayeur());
        });
        return new SuiviRejetBancaireResponse.FichePayeur(instrument.getReglement().getPayeurNom(),
                instrument.getReglement().getGroupePayeur() == null ? null : instrument.getReglement().getGroupePayeur().getLibelle(),
                clients.values().stream().filter(client -> Objects.equals(client.getAgence().getId(), agenceId))
                        .map(this::ficheClient).toList());
    }

    private SuiviRejetBancaireResponse.Client ficheClient(Client client) {
        boolean physical = client.getTypeClient() == TypeClient.PERSONNE_PHYSIQUE;
        boolean company = client.getTypeClient() == TypeClient.PERSONNE_MORALE;
        return new SuiviRejetBancaireResponse.Client(client.getId(), client.getCodeClient(), client.getNomAffichage(), client.getTypeClient(),
                physical ? client.getCin() : null, physical ? client.getPassport() : null, physical ? client.getCarteResidence() : null,
                company ? client.getRc() : null, company ? client.getIce() : null,
                company ? client.getIff() : null, company ? client.getPatente() : null,
                client.getAdresse(), client.getVille() == null ? null : client.getVille().getNom(), client.getTelephone(), client.getEmail());
    }

    private InstrumentReglementClient find(Long agenceId, Long id, boolean lock) {
        return (lock ? instruments.findByIdAndAgenceIdForUpdate(id, agenceId) : instruments.findByIdAndAgenceId(id, agenceId))
                .orElseThrow(() -> new ResourceNotFoundException("Instrument de règlement", id));
    }

    private void requireRejet(InstrumentReglementClient instrument, List<LigneBordereauRemise> history) {
        if (instrument.getMode() != ModeReglementClient.CHEQUE && instrument.getMode() != ModeReglementClient.EFFET) {
            throw new BadRequestException("Seuls les chèques et effets sont concernés par les rejets bancaires");
        }
        if (instrument.getDateRejet() == null && instrument.getStatut() != StatutInstrumentReglement.REJETE
                && history.stream().noneMatch(line -> line.getStatut() == StatutLigneBordereauRemise.REJETEE)) {
            throw new BadRequestException("Cet instrument n'a pas de rejet bancaire");
        }
    }

    private void collectReplacements(InstrumentReglementClient instrument, Set<Long> visited, List<InstrumentReglementClient> result) {
        if (!visited.add(instrument.getId())) return;
        for (InstrumentReglementClient child : enfants(instrument)) {
            result.add(child);
            collectReplacements(child, visited, result);
        }
    }

    private void addLegacyRejet(List<SuiviRejetBancaireResponse.Mouvement> events, String id, LocalDate date, String reason, Long instrumentId) {
        if (date != null && events.stream().noneMatch(event -> event.type() == TypeMouvementRejetBancaire.REJET
                && Objects.equals(event.date(), date) && Objects.equals(event.instrumentSourceId(), instrumentId))) {
            events.add(new SuiviRejetBancaireResponse.Mouvement(id, date, null, TypeMouvementRejetBancaire.REJET,
                    StatutSuiviRejetBancaire.INSTANCE, reason, null, instrumentId));
        }
    }

    private LocalDate latestRejetDate(List<LigneBordereauRemise> lines) {
        return lines.stream().filter(line -> line.getStatut() == StatutLigneBordereauRemise.REJETEE)
                .map(LigneBordereauRemise::getDateTraitement).filter(Objects::nonNull).max(LocalDate::compareTo).orElse(null);
    }

    private String latestRejetReason(List<LigneBordereauRemise> lines) {
        return lines.stream().filter(line -> line.getStatut() == StatutLigneBordereauRemise.REJETEE)
                .reduce((first, second) -> second).map(LigneBordereauRemise::getMotifRejet).orElse(null);
    }

    private BigDecimal money(BigDecimal amount) {
        return amount == null ? BigDecimal.ZERO : amount;
    }
}
