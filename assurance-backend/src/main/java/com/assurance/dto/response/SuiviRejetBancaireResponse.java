package com.assurance.dto.response;

import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutSuiviRejetBancaire;
import com.assurance.enums.TypeMouvementRejetBancaire;
import com.assurance.enums.TypeClient;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record SuiviRejetBancaireResponse(
        Long instrumentId, Long reglementId, String numeroReglement, String payeurNom,
        LocalDate dateReglement, LocalDate dateRejet, String motifRejet, String banque,
        StatutInstrumentReglement statutInstrument, StatutSuiviRejetBancaire statutSuivi,
        BigDecimal montant, BigDecimal contreValeurEncaissee, boolean reglementAnnule, LocalDate dateMinimumMouvement,
        List<StatutSuiviRejetBancaire> statutsAutorises, List<Mouvement> mouvements,
        List<Remise> remises, List<ContreValeur> contreValeurs
) {
    public record Mouvement(String id, LocalDate date, LocalDateTime enregistreLe,
                            TypeMouvementRejetBancaire type, StatutSuiviRejetBancaire statut,
                            String motif, String utilisateur, Long instrumentSourceId,
                            Long bordereauId, String numeroBordereau, boolean historiqueExistant, String libelle,
                            Long rejetId, String numeroRejet) {
        public Mouvement(String id, LocalDate date, LocalDateTime enregistreLe,
                         TypeMouvementRejetBancaire type, StatutSuiviRejetBancaire statut,
                         String motif, String utilisateur, Long instrumentSourceId,
                         Long bordereauId, String numeroBordereau, boolean historiqueExistant, String libelle) {
            this(id, date, enregistreLe, type, statut, motif, utilisateur, instrumentSourceId,
                    bordereauId, numeroBordereau, historiqueExistant, libelle, null, null);
        }
    }

    public record RejetDetail(Long id, String numero, Long instrumentId, String referenceInstrument,
                              ModeReglementClient mode, BigDecimal montant, String payeurNom,
                              Long reglementId, String numeroReglement, LocalDate dateRejet, String motif,
                              String banque, String utilisateur, Long bordereauId, String numeroBordereau,
                              List<Mouvement> mouvements) {
    }

    public record Remise(Long id, String numero, LocalDate dateDepot, LocalDate dateTraitement, String statut, String motif) {
    }

    public record ContreValeur(Long id, ModeReglementClient mode, String reference, BigDecimal montant,
                              StatutInstrumentReglement statut, Long instrumentRemplaceId) {
    }

    public record FichePayeur(String nom, String groupe, List<Client> clients) {
    }

    public record Client(Long id, String code, String nom, TypeClient typeClient,
                         String cin, String passport, String carteResidence, String rc, String ice, String iff, String patente,
                         String adresse, String ville, String telephone, String email) {
    }
}
