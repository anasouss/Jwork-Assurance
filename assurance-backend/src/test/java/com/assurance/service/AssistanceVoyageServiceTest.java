package com.assurance.service;

import com.assurance.dto.request.QuoteAssistanceVoyageRequest;
import com.assurance.dto.request.CreateAssistanceVoyageRequest;
import com.assurance.dto.request.SaveAssistanceVoyageDraftSectionRequest;
import com.assurance.dto.response.AssistanceDraftResponse;
import com.assurance.dto.response.AssistanceVoyageQuoteResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.BrancheAssurance;
import com.assurance.entity.Client;
import com.assurance.entity.CompagnieAssistance;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.CodePromoAssistance;
import com.assurance.entity.ProduitAssistance;
import com.assurance.entity.TarifProduitAssistance;
import com.assurance.entity.Ville;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.TypeClient;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.BrancheAssuranceRepository;
import com.assurance.repository.ClientRepository;
import com.assurance.repository.CompagnieAssistanceRepository;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.ElementFacturableRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.LigneTarificationAssistanceRepository;
import com.assurance.repository.ProduitAssistanceRepository;
import com.assurance.repository.TypeMouvementContratRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssistanceVoyageServiceTest {

    @Mock private AgenceRepository agenceRepository;
    @Mock private BrancheAssuranceRepository brancheAssuranceRepository;
    @Mock private CompagnieAssistanceRepository compagnieAssistanceRepository;
    @Mock private ProduitAssistanceRepository produitAssistanceRepository;
    @Mock private ContratRepository contratRepository;
    @Mock private ContratClientRepository contratClientRepository;
    @Mock private ClientRepository clientRepository;
    @Mock private ClientService clientService;
    @Mock private TarifProduitAssistanceService tarifProduitAssistanceService;
    @Mock private CodePromoAssistanceService codePromoAssistanceService;
    @Mock private TypeMouvementContratRepository typeMouvementContratRepository;
    @Mock private MouvementContratRepository mouvementContratRepository;
    @Mock private AssistanceContratRepository assistanceContratRepository;
    @Mock private ElementFacturableRepository elementFacturableRepository;
    @Mock private LigneTarificationAssistanceRepository ligneTarificationAssistanceRepository;
    @Mock private ContractDirectModificationPolicy directModificationPolicy;

    @InjectMocks
    private AssistanceVoyageService service;

    @Test
    void quoteUsesSixMonthTariffAndAppliesConfiguredPromotion() {
        CompagnieAssistance compagnie = CompagnieAssistance.builder().actif(true).build();
        compagnie.setId(10L);
        ProduitAssistance produit = ProduitAssistance.builder()
                .compagnieAssistance(compagnie)
                .type("Assistance Voyage")
                .actif(true)
                .build();
        produit.setId(20L);
        TarifProduitAssistance tarif = TarifProduitAssistance.builder()
                .montantHt(new BigDecimal("120.00"))
                .montantTtc(new BigDecimal("144.00"))
                .actif(true)
                .build();
        CodePromoAssistance promo = CodePromoAssistance.builder()
                .code("VOYAGE10")
                .tauxReduction(new BigDecimal("10"))
                .actif(true)
                .build();
        QuoteAssistanceVoyageRequest request = request(6);
        request.setCodePromo("voyage10");

        when(compagnieAssistanceRepository.findById(10L)).thenReturn(Optional.of(compagnie));
        when(produitAssistanceRepository.findById(20L)).thenReturn(Optional.of(produit));
        when(tarifProduitAssistanceService.resolveTravelTarif(produit, request.getDateEffet(), 6, 30))
                .thenReturn(tarif);
        when(codePromoAssistanceService.resolve(produit, "voyage10", request.getDateEffet()))
                .thenReturn(promo);

        AssistanceVoyageQuoteResponse quote = service.quote(request);

        assertThat(quote.getDateEcheance()).isEqualTo(LocalDate.of(2026, 6, 30));
        assertThat(quote.getPrimeNette()).isEqualByComparingTo("108.00");
        assertThat(quote.getPrimeTotale()).isEqualByComparingTo("129.60");
        assertThat(quote.getMontantReduction()).isEqualByComparingTo("14.40");
    }

    @Test
    void quoteRejectsUnsupportedDuration() {
        assertThatThrownBy(() -> service.quote(request(18)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("6 mois ou de 1 à 5 ans");
    }

    @Test
    void savingSubscriberCreatesDraftWithoutFinancialSideEffects() {
        Agence agence = Agence.builder().build();
        agence.setId(7L);
        BrancheAssurance branche = BrancheAssurance.builder().code("ASSISTANCE").build();
        branche.setId(3L);
        CompagnieAssistance compagnie = CompagnieAssistance.builder().actif(true).build();
        compagnie.setId(10L);
        ProduitAssistance produit = ProduitAssistance.builder()
                .compagnieAssistance(compagnie)
                .type("Assistance Voyage")
                .libelle("Voyage Monde")
                .actif(true)
                .build();
        produit.setId(20L);
        Client subscriber = Client.builder()
                .typeClient(TypeClient.PERSONNE_PHYSIQUE)
                .prenom("Sara")
                .nom("Amrani")
                .passport("PA123")
                .passportValidite(LocalDate.now().plusYears(1))
                .dateNaissance(LocalDate.of(1990, 1, 1))
                .nationalite("Marocaine")
                .adresse("Rue 1")
                .ville(Ville.builder().nom("Agadir").build())
                .telephone("0600000000")
                .build();
        subscriber.setId(40L);
        CreateAssistanceVoyageRequest.Personne person = new CreateAssistanceVoyageRequest.Personne();
        person.setClientId(40L);
        SaveAssistanceVoyageDraftSectionRequest request = new SaveAssistanceVoyageDraftSectionRequest();
        request.setCompagnieAssistanceId(10L);
        request.setProduitAssistanceId(20L);
        request.setSouscripteur(person);

        when(compagnieAssistanceRepository.findById(10L)).thenReturn(Optional.of(compagnie));
        when(produitAssistanceRepository.findById(20L)).thenReturn(Optional.of(produit));
        when(agenceRepository.findById(7L)).thenReturn(Optional.of(agence));
        when(brancheAssuranceRepository.findByCodeIgnoreCase("ASSISTANCE")).thenReturn(Optional.of(branche));
        when(contratRepository.save(any(Contrat.class))).thenAnswer(invocation -> {
            Contrat draft = invocation.getArgument(0);
            draft.setId(30L);
            return draft;
        });
        when(assistanceContratRepository.findByContratIdAndActifTrueOrderByCreatedAtDesc(30L))
                .thenReturn(List.of());
        when(clientRepository.findByAgenceIdAndId(7L, 40L)).thenReturn(Optional.of(subscriber));
        when(contratClientRepository.findByContratIdAndRole(any(), any())).thenReturn(List.of());
        when(contratClientRepository.save(any(ContratClient.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AssistanceDraftResponse response = service.saveDraftSection(7L, null, "souscripteur", request);

        assertThat(response.getContratId()).isEqualTo(30L);
        assertThat(response.getClientIds()).containsExactly(40L);
        verify(contratRepository).save(org.mockito.ArgumentMatchers.argThat(draft ->
                draft.getStatut() == StatutContrat.DRAFT
                        && Boolean.TRUE.equals(draft.getBrouillon())
                        && draft.getAgence().getId().equals(7L)
        ));
        verify(elementFacturableRepository, never()).save(any());
        verifyNoInteractions(mouvementContratRepository, ligneTarificationAssistanceRepository);
    }

    private QuoteAssistanceVoyageRequest request(int durationMonths) {
        QuoteAssistanceVoyageRequest request = new QuoteAssistanceVoyageRequest();
        request.setCompagnieAssistanceId(10L);
        request.setProduitAssistanceId(20L);
        request.setDateEffet(LocalDate.of(2026, 1, 1));
        request.setDureeMois(durationMonths);
        request.setDatesNaissanceAssures(List.of(LocalDate.of(1996, 1, 1)));
        return request;
    }
}
