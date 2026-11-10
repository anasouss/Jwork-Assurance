package com.assurance.dto.response;

import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.ResolutionRejetBancaire;
import com.assurance.enums.StatutAffectationReglement;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutSuiviRejetBancaire;
import com.assurance.enums.StatutReglementClient;
import com.assurance.enums.StatutBordereauRemise;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter
@Builder(toBuilder = true)
public class ReglementClientResponse {
    private Long id;
    private String numero;
    private LocalDate dateReglement;
    private Long clientPayeurId;
    private Long groupePayeurId;
    private String payeurNom;
    private Boolean multiPayeur;
    private String deposantNom;
    private String bordereauNomFichier;
    private String bordereauContentType;
    private Long bordereauTailleOctets;
    private StatutReglementClient statut;
    private BigDecimal montantTotal;
    private BigDecimal montantNonAffecte;
    private String notes;
    private String quittancePrimeNumero;
    private LocalDate quittancePrimeDateEmission;
    private Long creeParId;
    private String creePar;
    private Long modifieParId;
    private Long valideParId;
    private String validePar;
    private java.time.LocalDateTime dateValidation;
    private List<Instrument> instruments;
    private Detail detail;

    @Getter
    @Builder
    public static class Detail {
        private BigDecimal totalRegle;
        private BigDecimal totalEncaisse;
        private BigDecimal totalEnAttente;
        private BigDecimal totalQuittances;
        private BigDecimal solde;
        private List<Production> productions;
    }

    @Getter
    @Builder
    public static class Production {
        private String key;
        private Long elementFacturableId;
        private Long documentClientId;
        private String numeroPolice;
        private String compagnie;
        private String assure;
        private String mouvement;
        private String referenceDocument;
        private LocalDate dateDebut;
        private LocalDate dateFin;
        private BigDecimal montantQuittance;
        private BigDecimal montantRegle;
        private BigDecimal montantEncaisse;
        private BigDecimal montantEnAttente;
        private BigDecimal solde;
    }

    @Getter
    @Builder
    public static class Instrument {
        private Long id;
        private Long reglementId;
        private Long clientPayeurId;
        private String numeroReglement;
        private StatutReglementClient statutReglement;
        private String payeurNom;
        private ModeReglementClient mode;
        private StatutInstrumentReglement statut;
        private BigDecimal montant;
        private LocalDate dateInstrument;
        private LocalDate dateReglement;
        private StatutSuiviRejetBancaire statutSuiviRejet;
        private LocalDate dateEcheance;
        private LocalDate dateStatut;
        private String referenceInstrument;
        private Long banqueEmettriceId;
        private String banqueEmettriceCode;
        private String banqueEmettrice;
        private Boolean reglementBureau;
        private String motifStatut;
        private LocalDate dateRejet;
        private String motifRejet;
        private ResolutionRejetBancaire resolutionRejet;
        private Boolean rejetBancairePossible;
        private Boolean representationPossible;
        private Boolean remplacementPossible;
        private Long instrumentRemplaceId;
        private ModeReglementClient modeInstrumentRemplace;
        private String referenceInstrumentRemplace;
        private Long compteTresorerieId;
        private String compteTresorerie;
        private Long bordereauRemiseId;
        private String numeroBordereauRemise;
        private StatutBordereauRemise statutBordereauRemise;
        private List<Affectation> affectations;
    }

    @Getter
    @Builder
    public static class Affectation {
        private Long id;
        private Long elementFacturableId;
        private Long documentClientId;
        private String payeurType;
        private Long payeurId;
        private String payeurNom;
        private String destination;
        private String numeroPolice;
        private String mouvement;
        private String referenceDocument;
        private BigDecimal montant;
        private StatutAffectationReglement statut;
    }
}
