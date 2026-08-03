package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.Client;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.ContratGarantie;
import com.assurance.entity.Garantie;
import com.assurance.entity.Marque;
import com.assurance.entity.ProduitAssistance;
import com.assurance.entity.Usage;
import com.assurance.entity.Vehicule;
import com.assurance.entity.Ville;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeVehiculeContrat;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.ContratGarantieRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.VehiculeRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import javax.imageio.ImageIO;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PreTermeFlottePdfServiceTest {

    private final ContratRepository contratRepository = mock(ContratRepository.class);
    private final VehiculeRepository vehiculeRepository = mock(VehiculeRepository.class);
    private final ContratGarantieRepository contratGarantieRepository = mock(ContratGarantieRepository.class);
    private final AssistanceContratRepository assistanceContratRepository = mock(AssistanceContratRepository.class);
    private final QuittanceCalculService quittanceCalculService = mock(QuittanceCalculService.class);

    private PreTermeFlottePdfService service;

    private final Path previewDir = Path.of("target", "pdf-previews");

    @BeforeEach
    void setUp() {
        service = new PreTermeFlottePdfService(
                contratRepository,
                vehiculeRepository,
                contratGarantieRepository,
                assistanceContratRepository,
                quittanceCalculService,
                new RichTextPdfRenderer()
        );

        Contrat draft = draft();
        Vehicule vehicule = vehicule(draft);
        List<ContratGarantie> garanties = garanties(draft, vehicule);

        when(contratRepository.findByAgenceIdAndId(1L, 10L)).thenReturn(Optional.of(draft));
        when(vehiculeRepository.findActiveByContratIdOrderByCreatedAtAsc(10L)).thenReturn(List.of(vehicule));
        when(contratGarantieRepository.findActiveByContratId(10L)).thenReturn(garanties);
        when(assistanceContratRepository.findByContratIdAndActifTrueOrderByCreatedAtDesc(10L))
                .thenReturn(List.of(assistance(draft, vehicule)));
        when(quittanceCalculService.calculer(any(), any(), any(), anyInt())).thenReturn(new QuittanceCalculService.Resultat(
                List.of(),
                new BigDecimal("1100.00"),
                new BigDecimal("170.50"),
                new BigDecimal("16.50"),
                BigDecimal.ZERO,
                new BigDecimal("17.00"),
                new BigDecimal("1304.00")
        ));
    }

    @Test
    void generateAvecPrimeMatchesLegacyCopyAndStructure() throws Exception {
        byte[] bytes = service.generate(1L, 10L, true);
        Files.createDirectories(previewDir);
        Files.write(previewDir.resolve("pre-terme-avec-prime.pdf"), bytes);

        try (PDDocument pdf = PDDocument.load(bytes)) {
            ImageIO.write(new PDFRenderer(pdf).renderImageWithDPI(0, 130), "png", previewDir.resolve("pre-terme-avec-prime.png").toFile());
            String text = new PDFTextStripper().getText(pdf);
            assertThat(pdf.getPage(0).getMediaBox().getWidth()).isGreaterThan(pdf.getPage(0).getMediaBox().getHeight());
            assertThat(text)
                    .contains("PROPOSITION D'ASSURANCE")
                    .contains("FLOTTE AUTOMOBILE")
                    .contains("Police N° FL-2026-001")
                    .contains("Messieurs,")
                    .contains("Nous avons l'honneur de vous communiquer ci-dessous notre proposition d'assurance automobile")
                    .contains("Du 01/01/2027  Au 31/12/2027")
                    .contains("I. Le tarif")
                    .contains("GARANTIES ASSUREES")
                    .contains("Montant total")
                    .contains("II. Les franchises")
                    .contains("III. Les prestations d'assistance")
                    .contains("Assistance Gold")
                    .contains("Dépannage et remorquage")
                    .contains("DV2: DOMMAGES AUX VEHICULES")
                    .contains("V3: VOL")
                    .contains("1 404");
        }
    }

    @Test
    void generateSansPrimeMatchesLegacyCopyAndHidesAmounts() throws Exception {
        byte[] bytes = service.generate(1L, 10L, false);
        Files.createDirectories(previewDir);
        Files.write(previewDir.resolve("pre-terme-sans-prime.pdf"), bytes);

        try (PDDocument pdf = PDDocument.load(bytes)) {
            ImageIO.write(new PDFRenderer(pdf).renderImageWithDPI(0, 130), "png", previewDir.resolve("pre-terme-sans-prime.png").toFile());
            String text = new PDFTextStripper().getText(pdf);
            assertThat(text)
                    .contains("L'Etat du parc Flotte Automobile")
                    .contains("Nous avons l'honneur de vous communiquer ci-dessous, pour validation, l'état de votre parc flotte automobile")
                    .contains("(31/12/2027)")
                    .contains("I. L'état des véhicules et garanties assurées")
                    .doesNotContain("Montant total")
                    .doesNotContain("1 404");
        }
    }

    private Contrat draft() {
        Agence agence = Agence.builder().code("AG").nom("Agence Agadir").ville("Agadir").build();
        agence.setId(1L);
        Client client = Client.builder()
                .agence(agence)
                .nom("ENTREPRISE")
                .prenom("TEST")
                .adresse("10 Avenue Hassan II")
                .ville(Ville.builder().nom("Agadir").build())
                .build();
        Contrat draft = Contrat.builder()
                .agence(agence)
                .contratOrigine(Contrat.builder().agence(agence).typeContrat(TypeContrat.FLOTTE).build())
                .typeContrat(TypeContrat.FLOTTE)
                .statut(StatutContrat.DRAFT)
                .brouillon(true)
                .numeroPolice("FL-2026-001")
                .dateEffet(LocalDate.of(2027, 1, 1))
                .dateEcheance(LocalDate.of(2027, 12, 31))
                .build();
        draft.setId(10L);
        draft.setCreatedAt(LocalDateTime.of(2026, 12, 15, 9, 0));
        draft.setClients(List.of(ContratClient.builder()
                .contrat(draft)
                .client(client)
                .role(RoleClientContrat.SOUSCRIPTEUR)
                .build()));
        return draft;
    }

    private Vehicule vehicule(Contrat draft) {
        Usage usage = Usage.builder().code("A").libelle("TOURISME").build();
        usage.setId(1L);
        Vehicule vehicule = Vehicule.builder()
                .contrat(draft)
                .typeVehicule(TypeVehiculeContrat.AUTOMOBILE)
                .usage(usage)
                .marque(Marque.builder().libelle("RENAULT").build())
                .immatriculation("12345-A-6")
                .datePremiereCirculation(LocalDate.of(2020, 2, 10))
                .puissanceFiscale("7")
                .carburant("Diesel")
                .valeurNeuf(new BigDecimal("190000"))
                .valeurVenale(new BigDecimal("150000"))
                .valeurGlace(new BigDecimal("7000"))
                .build();
        vehicule.setId(100L);
        return vehicule;
    }

    private List<ContratGarantie> garanties(Contrat draft, Vehicule vehicule) {
        Garantie rc = Garantie.builder()
                .code("RC")
                .libelle("Responsabilite Civile")
                .responsabiliteCivile(true)
                .ordreAffichage(1)
                .build();
        Garantie dv = Garantie.builder()
                .code("DV")
                .libelle("Dommages aux Vehicules")
                .ordreAffichage(2)
                .build();
        Garantie vol = Garantie.builder()
                .code("V")
                .libelle("Vol")
                .ordreAffichage(3)
                .build();
        return List.of(
                ContratGarantie.builder()
                        .contrat(draft)
                        .vehicule(vehicule)
                        .garantie(rc)
                        .prime(new BigDecimal("900"))
                        .capital(new BigDecimal("50000000"))
                        .build(),
                ContratGarantie.builder()
                        .contrat(draft)
                        .vehicule(vehicule)
                        .garantie(dv)
                        .prime(new BigDecimal("200"))
                        .capital(new BigDecimal("150000"))
                        .taux(new BigDecimal("0.4"))
                        .tauxFranchise(new BigDecimal("3"))
                        .franchiseMinimale(new BigDecimal("1500"))
                        .build(),
                ContratGarantie.builder()
                        .contrat(draft)
                        .vehicule(vehicule)
                        .garantie(vol)
                        .prime(BigDecimal.ZERO)
                        .taux(BigDecimal.ZERO)
                        .build()
        );
    }

    private AssistanceContrat assistance(Contrat draft, Vehicule vehicule) {
        return AssistanceContrat.builder()
                .contrat(draft)
                .vehicule(vehicule)
                .produit("Assistance Gold")
                .produitAssistance(ProduitAssistance.builder()
                        .libelle("Assistance Gold")
                        .prestations("Dépannage et remorquage")
                        .build())
                .primeTotale(new BigDecimal("100.00"))
                .actif(true)
                .build();
    }
}
