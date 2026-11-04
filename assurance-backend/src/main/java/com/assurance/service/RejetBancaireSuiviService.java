package com.assurance.service;

import com.assurance.dto.request.AjouterMouvementRejetRequest;
import com.assurance.dto.response.SuiviRejetBancaireResponse;
import com.assurance.entity.Client;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.LigneBordereauRemise;
import com.assurance.entity.MouvementRejetBancaire;
import com.assurance.entity.RejetBancaire;
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
import com.assurance.repository.UtilisateurRepository;
import com.assurance.repository.RejetBancaireRepository;
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
    private final UtilisateurRepository utilisateurs;
    private final RejetBancaireRepository rejets;

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
                .map(this::movementResponse).toList());
        List<RejetBancaire> occurrences = rejets.findByAgenceIdAndInstrumentIdOrderByIdAsc(agenceId, instrumentId);
        for (RejetBancaire rejet : occurrences) {
            if (events.stream().noneMatch(event -> event.type() == TypeMouvementRejetBancaire.REJET
                    && Objects.equals(event.rejetId(), rejet.getId()))) {
                var line = rejet.getLigneRemise();
                events.add(new SuiviRejetBancaireResponse.Mouvement("rejet-" + rejet.getId(), rejet.getDateRejet(),
                        rejet.getCreatedAt(), TypeMouvementRejetBancaire.REJET, StatutSuiviRejetBancaire.INSTANCE,
                        rejet.getMotif(), rejet.getUtilisateurNom(), instrumentId,
                        line == null ? null : line.getBordereau().getId(), line == null ? null : line.getBordereau().getNumero(),
                        false, "Rejet bancaire", rejet.getId(), rejet.getNumero()));
            }
        }
        // Reconstruct dated bank events from existing slips without creating audit records.
        Long firstRejectedSlip = history.stream().filter(line -> line.getStatut() == StatutLigneBordereauRemise.REJETEE)
                .map(line -> line.getBordereau().getId()).min(Long::compareTo).orElse(null);
        for (LigneBordereauRemise line : history) {
            boolean represented = firstRejectedSlip != null ? line.getBordereau().getId() > firstRejectedSlip
                    : instrument.getDateRejet() != null && line.getBordereau().getDateDepot() != null
                        && line.getBordereau().getDateDepot().isAfter(instrument.getDateRejet());
            mergeBankEvent(events, history, line, instrumentId, TypeMouvementRejetBancaire.REMISE_EN_BANQUE,
                    line.getBordereau().getDateDepot(), represented ? "Nouvelle remise en banque" : "Remise initiale en banque", null);
            if (line.getStatut() == StatutLigneBordereauRemise.REJETEE) {
                boolean linked = occurrences.stream().anyMatch(rejet -> rejet.getLigneRemise() != null
                        && Objects.equals(rejet.getLigneRemise().getId(), line.getId()));
                if (!linked) addLegacyBankRejection(events, line, instrumentId);
            } else if (line.getStatut() == StatutLigneBordereauRemise.ENCAISSEE) {
                mergeBankEvent(events, history, line, instrumentId, TypeMouvementRejetBancaire.ENCAISSEMENT,
                        line.getDateTraitement(), "Encaissement confirmé", null);
            }
        }
        addLegacyRejet(events, "instrument-" + instrumentId,
                instrument.getDateRejet() != null ? instrument.getDateRejet()
                        : instrument.getStatut() == StatutInstrumentReglement.REJETE ? instrument.getDateStatut() : null,
                instrument.getMotifRejet() != null ? instrument.getMotifRejet() : instrument.getMotifStatut(), instrumentId);
        events.sort(this::compareEvents);
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

    private SuiviRejetBancaireResponse.Mouvement movementResponse(MouvementRejetBancaire event) {
        RejetBancaire rejet = event.getRejet();
        var line = rejet == null || event.getType() != TypeMouvementRejetBancaire.REJET ? null : rejet.getLigneRemise();
        String label = event.getType() == TypeMouvementRejetBancaire.REJET && rejet == null
                ? "Trace de rejet non rattachée" : null;
        return new SuiviRejetBancaireResponse.Mouvement(event.getId().toString(), event.getDateOperation(),
                event.getCreatedAt(), event.getType(), event.getStatutSuivi(), event.getMotif(), event.getUtilisateurNom(),
                event.getInstrumentSource() == null ? null : event.getInstrumentSource().getId(),
                line == null ? null : line.getBordereau().getId(), line == null ? null : line.getBordereau().getNumero(),
                false, label, rejet == null ? null : rejet.getId(), rejet == null ? null : rejet.getNumero());
    }

    private void addLegacyBankRejection(List<SuiviRejetBancaireResponse.Mouvement> events,
                                         LigneBordereauRemise line, Long instrumentId) {
        if (line.getDateTraitement() == null) return;
        events.add(new SuiviRejetBancaireResponse.Mouvement("bordereau-" + line.getId() + "-REJET",
                line.getDateTraitement(), null, TypeMouvementRejetBancaire.REJET, StatutSuiviRejetBancaire.INSTANCE,
                line.getMotifRejet(), null, instrumentId, line.getBordereau().getId(), line.getBordereau().getNumero(),
                true, "Rejet bancaire"));
    }

    @Transactional(readOnly = true)
    public SuiviRejetBancaireResponse.RejetDetail detailRejet(Long agenceId, Long rejetId) {
        RejetBancaire rejet = rejets.findByIdAndAgenceId(rejetId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Rejet bancaire", rejetId));
        var instrument = rejet.getInstrument();
        var payment = instrument.getReglement();
        var line = rejet.getLigneRemise();
        var events = mouvements.findByAgenceIdAndInstrumentIdOrderByDateOperationAscIdAsc(agenceId, instrument.getId())
                .stream().filter(event -> event.getRejet() != null && Objects.equals(event.getRejet().getId(), rejetId))
                .map(this::movementResponse).toList();
        return new SuiviRejetBancaireResponse.RejetDetail(rejet.getId(), rejet.getNumero(), instrument.getId(),
                instrument.getReferenceInstrument(), instrument.getMode(), rejet.getMontant(), payment.getPayeurNom(),
                payment.getId(), payment.getNumero(), rejet.getDateRejet(), rejet.getMotif(),
                instrument.getBanqueEmettriceReference() == null ? null : instrument.getBanqueEmettriceReference().getLibelle(),
                rejet.getUtilisateurNom(), line == null ? null : line.getBordereau().getId(),
                line == null ? null : line.getBordereau().getNumero(), events);
    }

    @Transactional
    public void enregistrerRejet(InstrumentReglementClient source, LigneBordereauRemise line, LocalDate date, String motif) {
        Long agenceId = source.getAgence().getId();
        if (line != null && (!Objects.equals(line.getInstrument().getId(), source.getId())
                || !Objects.equals(line.getBordereau().getAgence().getId(), agenceId))) {
            throw new BadRequestException("La remise ne correspond pas à l'instrument rejeté");
        }
        // The atomic upsert holds the agency/year counter lock until this transaction commits.
        rejets.incrementSequence(agenceId, date.getYear());
        RejetBancaire rejet = new RejetBancaire();
        rejet.setAgence(source.getAgence());
        rejet.setInstrument(source);
        rejet.setLigneRemise(line);
        rejet.setAnnee(date.getYear());
        rejet.setSequenceNumero(rejets.currentSequence(agenceId, date.getYear()));
        rejet.setNumero(String.format(java.util.Locale.ROOT, "REJ%02d-%04d", date.getYear() % 100, rejet.getSequenceNumero()));
        rejet.setDateRejet(date);
        rejet.setMotif(motif.trim());
        rejet.setMontant(source.getMontant());
        rejet.setUtilisateurId(TenantContext.getCurrentUser());
        rejet.setUtilisateurNom(operatorName(source));
        rejets.saveAndFlush(rejet);
        InstrumentReglementClient current = source;
        Set<Long> visited = new HashSet<>();
        while (current != null && visited.add(current.getId())
                && Objects.equals(current.getAgence().getId(), agenceId)
                && Objects.equals(current.getReglement().getId(), source.getReglement().getId())) {
            enregistrer(current, source, TypeMouvementRejetBancaire.REJET, date, motif.trim(), rejet);
            current = current.getInstrumentRemplace();
        }
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
        if (type == TypeMouvementRejetBancaire.REJET) {
            throw new BadRequestException("Un rejet doit être enregistré avec sa référence et sa remise source");
        }
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
        RejetBancaire dernierRejet = mouvements
                .findByAgenceIdAndInstrumentIdOrderByDateOperationAscIdAsc(instrument.getAgence().getId(), instrument.getId())
                .stream().filter(event -> event.getType() == TypeMouvementRejetBancaire.REJET && event.getRejet() != null)
                .reduce((first, second) -> second).map(MouvementRejetBancaire::getRejet).orElse(null);
        if (dernierRejet == null) {
            dernierRejet = rejets.findByAgenceIdAndInstrumentIdOrderByIdAsc(instrument.getAgence().getId(), instrument.getId())
                    .stream().reduce((first, second) -> second).orElse(null);
        }
        enregistrer(instrument, source, type, date, motif, dernierRejet);
    }

    private void enregistrer(InstrumentReglementClient instrument, InstrumentReglementClient source,
                             TypeMouvementRejetBancaire type, LocalDate date, String motif, RejetBancaire rejet) {
        MouvementRejetBancaire event = new MouvementRejetBancaire();
        event.setAgence(instrument.getAgence());
        event.setInstrument(instrument);
        event.setInstrumentSource(source);
        event.setRejet(rejet);
        event.setDateOperation(date);
        event.setType(type);
        event.setStatutSuivi(statut(instrument));
        event.setMotif(motif);
        event.setUtilisateurId(TenantContext.getCurrentUser());
        event.setUtilisateurNom(operatorName(instrument));
        mouvements.save(event);
    }

    private String operatorName(InstrumentReglementClient instrument) {
        Long userId = TenantContext.getCurrentUser();
        return userId == null ? null : utilisateurs
                .findFullNameByIdAndAgenceId(userId, instrument.getAgence().getId())
                .filter(name -> !name.isBlank()).orElse(null);
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
                    StatutSuiviRejetBancaire.INSTANCE, reason, null, instrumentId, null, null, true, "Rejet bancaire"));
        }
    }

    private void mergeBankEvent(List<SuiviRejetBancaireResponse.Mouvement> events, List<LigneBordereauRemise> history,
                                LigneBordereauRemise line, Long instrumentId, TypeMouvementRejetBancaire type,
                                LocalDate date, String label, String reason) {
        if (date == null) return;
        List<SuiviRejetBancaireResponse.Mouvement> matches = events.stream()
                .filter(event -> event.type() == type && date.equals(event.date()) && event.bordereauId() == null
                        && Objects.equals(event.instrumentSourceId(), instrumentId)).toList();
        long slipCount = history.stream().filter(candidate -> type == TypeMouvementRejetBancaire.REMISE_EN_BANQUE
                ? date.equals(candidate.getBordereau().getDateDepot())
                : date.equals(candidate.getDateTraitement()) && candidate.getStatut() == line.getStatut()).count();
        // Do not attribute an operator to a particular slip when same-day evidence is ambiguous.
        if (matches.size() == 1 && slipCount == 1) {
            var event = matches.get(0);
            events.set(events.indexOf(event), new SuiviRejetBancaireResponse.Mouvement(event.id(), event.date(), event.enregistreLe(),
                    event.type(), event.statut(), event.motif() != null ? event.motif() : reason, event.utilisateur(), event.instrumentSourceId(),
                    line.getBordereau().getId(), line.getBordereau().getNumero(), event.historiqueExistant(), label,
                    event.rejetId(), event.numeroRejet()));
        } else {
            StatutSuiviRejetBancaire status = type == TypeMouvementRejetBancaire.REJET
                    ? StatutSuiviRejetBancaire.INSTANCE : StatutSuiviRejetBancaire.REPRESENTE;
            events.add(new SuiviRejetBancaireResponse.Mouvement("bordereau-" + line.getId() + "-" + type.name(), date, null,
                    type, status, reason, null, instrumentId, line.getBordereau().getId(), line.getBordereau().getNumero(), true, label));
        }
    }

    private int compareEvents(SuiviRejetBancaireResponse.Mouvement first, SuiviRejetBancaireResponse.Mouvement second) {
        return Comparator.comparing(SuiviRejetBancaireResponse.Mouvement::date,
                        Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(SuiviRejetBancaireResponse.Mouvement::enregistreLe, Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(SuiviRejetBancaireResponse.Mouvement::bordereauId, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparingInt(this::eventOrder).compare(first, second);
    }

    private int eventOrder(SuiviRejetBancaireResponse.Mouvement event) {
        return switch (event.type()) {
            case REMISE_EN_BANQUE -> "Remise initiale en banque".equals(event.libelle()) ? 0 : 3;
            case REJET -> 1;
            case PREPARATION_REMISE -> 2;
            case REMPLACEMENT -> 3;
            case ENCAISSEMENT -> 4;
            case SUIVI -> 5;
        };
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
