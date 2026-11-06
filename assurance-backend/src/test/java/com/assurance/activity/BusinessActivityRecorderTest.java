package com.assurance.activity;

import com.assurance.entity.Utilisateur;
import com.assurance.entity.Role;
import com.assurance.entity.Permission;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.BusinessActivityRepository;
import com.assurance.repository.UtilisateurRepository;
import com.assurance.security.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class BusinessActivityRecorderTest {
    @Mock BusinessActivityRepository repository;
    @Mock AgenceRepository agencies;
    @Mock UtilisateurRepository users;
    BusinessActivityRecorder recorder;

    @BeforeEach
    void setup() {
        recorder = new BusinessActivityRecorder(repository, agencies, users, new ObjectMapper());
        TenantContext.setCurrentAgence(1L);
    }

    @AfterEach
    void cleanup() {
        TenantContext.clear();
    }

    @Test
    void rejectsForeignAgencyEvenForOtherwiseValidCommand() {
        assertThatThrownBy(() -> recorder.record(command(2L, ActivityAction.CREATED, List.of())))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(repository, users, agencies);
    }

    @Test
    void omitsNoOpModification() {
        recorder.record(command(1L, ActivityAction.UPDATED, List.of(new ActivityChange("Police", "123", "123"))));
        verifyNoInteractions(repository, users, agencies);
    }

    @Test
    void storesActualOperatorNameAndHistoricalReference() {
        TenantContext.setCurrentUser(9L);
        Utilisateur actor = Utilisateur.builder().prenom("Mohammed").nom("Melymane").build();
        actor.setId(9L);
        when(users.findById(9L)).thenReturn(Optional.of(actor));
        recorder.record(command(1L, ActivityAction.CREATED, List.of(new ActivityChange("Police", null, "123"))));

        verify(repository).save(argThat(event -> event.getActor() == actor
                && "Mohammed Melymane".equals(event.getActorName())
                && "MATU26-0027".equals(event.getSubjectLabel())
                && event.getChangesJson().contains("Police")));
    }

    @Test
    void explicitWorkflowRecordsOneEventAndIncludesSupportingReferences() {
        String result = recorder.perform(() -> {
            recorder.record(new ActivityCommand(1L, ActivityModule.CRM, ActivityAction.CREATED,
                    "Client cree", "CLIENT_CREATION",
                    ActivityReference.of(ActivityRecordType.CLIENT, 57L, "Mohamed Boukha"), List.of(), List.of()));
            return "ok";
        }, value -> command(1L, ActivityAction.VALIDATED, List.of()));

        assertThat(result).isEqualTo("ok");
        verify(repository).save(argThat(event -> event.getAction() == ActivityAction.VALIDATED
                && event.getReferencesJson().contains("Mohamed Boukha")));
    }

    @Test
    void failedWorkflowDoesNotWriteAndDoesNotLeakItsScope() {
        assertThatThrownBy(() -> recorder.perform(() -> {
            recorder.record(command(1L, ActivityAction.CREATED, List.of()));
            throw new IllegalArgumentException("Validation impossible");
        }, value -> command(1L, ActivityAction.VALIDATED, List.of())))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(repository);

        recorder.record(command(1L, ActivityAction.CREATED, List.of()));
        verify(repository).save(argThat(event -> event.getAction() == ActivityAction.CREATED));
    }

    @Test
    void childBusinessChangesAreNotLostWhenParentFieldsAreUnchanged() {
        recorder.perform(() -> {
            recorder.record(new ActivityCommand(1L, ActivityModule.CRM, ActivityAction.UPDATED,
                    "Client modifie", "CLIENT_UPDATE",
                    ActivityReference.of(ActivityRecordType.CLIENT, 57L, "C000057 - Mohamed Boukha"), List.of(),
                    List.of(new ActivityChange("Adresse", "Ancienne adresse", "Nouvelle adresse"))));
            return "ok";
        }, value -> command(1L, ActivityAction.SAVED, List.of()));

        verify(repository).save(argThat(event -> event.getAction() == ActivityAction.SAVED
                && event.getChangesJson().contains("Nouvelle adresse")
                && event.getReferencesJson().contains("C000057")));
    }

    @Test
    void noOpAggregateDoesNotCreateActivity() {
        recorder.perform(() -> "ok", value -> command(1L, ActivityAction.SAVED, List.of()));
        verifyNoInteractions(repository, users, agencies);
    }

    @Test
    void platformWorkflowKeepsEachAgencysDetailsInItsOwnEvent() {
        TenantContext.setCurrentAgence(null);
        recorder.perform(() -> {
            recorder.record(command(2L, ActivityAction.UPDATED,
                    List.of(new ActivityChange("Compte de l'ancienne agence", "Actif", "Inactif"))));
            return "ok";
        }, value -> command(1L, ActivityAction.UPDATED,
                List.of(new ActivityChange("Compte de la nouvelle agence", null, "Actif"))));

        var captured = org.mockito.ArgumentCaptor.forClass(com.assurance.entity.BusinessActivity.class);
        verify(repository, org.mockito.Mockito.times(2)).save(captured.capture());
        assertThat(captured.getAllValues().get(0).getChangesJson()).contains("ancienne agence").doesNotContain("nouvelle agence");
        assertThat(captured.getAllValues().get(1).getChangesJson()).contains("nouvelle agence").doesNotContain("ancienne agence");
        assertThat(captured.getAllValues().get(1).getReferencesJson()).isEqualTo("[]");
    }

    @Test
    void platformAdministrationStaysGlobalEvenWithAnAgencySelected() {
        TenantContext.setCurrentUser(9L);
        Utilisateur actor = Utilisateur.builder().prenom("Platform").nom("Admin")
                .role(Role.builder().code("SUPER_ADMIN").build()).build();
        when(users.findById(9L)).thenReturn(Optional.of(actor));

        recorder.recordPlatform(platformCommand());

        verify(repository).save(argThat(event -> event.getAgence() == null
                && event.getModule() == ActivityModule.ADMINISTRATION && event.getActor() == actor));
        assertThat(TenantContext.getCurrentAgence()).isEqualTo(1L);
        verifyNoInteractions(agencies);
    }

    @Test
    void agencyAdministratorCannotUseGlobalRecordingPath() {
        TenantContext.setCurrentUser(9L);
        Utilisateur actor = Utilisateur.builder().prenom("Agency").nom("Admin")
                .role(Role.builder().code("AGENCY_ADMIN").build()).build();
        when(users.findById(9L)).thenReturn(Optional.of(actor));

        assertThatThrownBy(() -> recorder.recordPlatform(platformCommand())).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(repository, agencies);
    }

    @Test
    void globalRecordingCannotBypassAnOperationalAgencysBoundary() {
        TenantContext.setCurrentUser(9L);
        Utilisateur actor = Utilisateur.builder().role(Role.builder().code("SUPER_ADMIN").build()).build();
        when(users.findById(9L)).thenReturn(Optional.of(actor));

        assertThatThrownBy(() -> recorder.recordPlatform(command(2L, ActivityAction.CREATED, List.of())))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(repository, agencies);
    }

    private ActivityCommand platformCommand() {
        return new ActivityCommand(null, ActivityModule.ADMINISTRATION, ActivityAction.CREATED,
                "Administrateur plateforme cree", "PLATFORM_ADMIN_CREATE",
                ActivityReference.of(ActivityRecordType.UTILISATEUR, 10L, "Nouvel administrateur"), List.of(), List.of());
    }

    @Test
    void globalFiscalConfigurationDoesNotBecomeAgencyOwned() {
        TenantContext.setCurrentUser(9L);
        var agency = com.assurance.entity.Agence.builder().build();
        agency.setId(1L);
        Utilisateur actor = Utilisateur.builder().agence(agency).prenom("Fiscal").nom("Manager").role(Role.builder()
                .code("MANAGER")
                .permissions(java.util.Set.of(Permission.builder().code("regle-fiscale:manage").build())).build()).build();
        when(users.findById(9L)).thenReturn(Optional.of(actor));

        recorder.recordGlobalReference(globalFiscalCommand());

        verify(repository).save(argThat(event -> event.getAgence() == null && event.getActor() == actor
                && event.getSubjectType() == ActivityRecordType.REGLE_FISCALE));
        assertThat(TenantContext.getCurrentAgence()).isEqualTo(1L);
        verifyNoInteractions(agencies);
    }

    @Test
    void globalReferenceWriterRejectsAViewerAndOperationalCommands() {
        TenantContext.setCurrentUser(9L);
        Utilisateur actor = Utilisateur.builder().role(Role.builder().build()).build();
        when(users.findById(9L)).thenReturn(Optional.of(actor));
        assertThatThrownBy(() -> recorder.recordGlobalReference(globalFiscalCommand())).isInstanceOf(AccessDeniedException.class);

        actor.setRole(Role.builder().permissions(java.util.Set.of(Permission.builder().code("config:manage").build())).build());
        assertThatThrownBy(() -> recorder.recordGlobalReference(command(2L, ActivityAction.CREATED, List.of())))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(repository, agencies);
    }

    private ActivityCommand globalFiscalCommand() {
        return new ActivityCommand(null, ActivityModule.REFERENTIELS, ActivityAction.CREATED,
                "Regle fiscale creee", "FISCAL_RULE_CREATE",
                ActivityReference.of(ActivityRecordType.REGLE_FISCALE, 20L, "Taxe assurance"), List.of(), List.of());
    }

    @Test
    void companyCatalogueNeverCopiesAnAgencyIntermediaryCodeIntoGlobalHistory() {
        TenantContext.setCurrentUser(9L);
        var agency = com.assurance.entity.Agence.builder().build();
        agency.setId(1L);
        var actor = Utilisateur.builder().agence(agency).prenom("Agency").nom("Manager")
                .role(Role.builder().code("AGENCY_ADMIN")
                        .permissions(java.util.Set.of(Permission.builder().code("referentiel:manage").build())).build()).build();
        when(users.findById(9L)).thenReturn(Optional.of(actor));
        when(agencies.getReferenceById(1L)).thenReturn(agency);
        var company = com.assurance.entity.CompagnieAssurance.builder().code("ATL").nom("Compagnie Atlas").build();
        company.setId(4L);
        var configuration = com.assurance.entity.AgenceCompagnieAssurance.builder()
                .agence(agency).compagnieAssurance(company).codeIntermediaire("AGENCY-ONLY-123").build();
        configuration.setId(50L);

        recorder.recordGlobalReference(CompanyCatalogueActivity.command(null, CompanyCatalogueActivity.state(company),
                ActivityAction.CREATED, "Compagnie creee", "INSURANCE_COMPANY_CREATE"));
        recorder.record(CompanyCatalogueActivity.command(null, CompanyCatalogueActivity.state(configuration),
                ActivityAction.CREATED, "Code intermediaire enregistre", "AGENCY_COMPANY_INTERMEDIARY_SAVE"));

        var events = org.mockito.ArgumentCaptor.forClass(com.assurance.entity.BusinessActivity.class);
        verify(repository, org.mockito.Mockito.times(2)).save(events.capture());
        assertThat(events.getAllValues().get(0).getAgence()).isNull();
        assertThat(events.getAllValues().get(0).getChangesJson()).doesNotContain("AGENCY-ONLY-123");
        assertThat(events.getAllValues().get(1).getAgence()).isSameAs(agency);
        assertThat(events.getAllValues().get(1).getChangesJson()).contains("AGENCY-ONLY-123");
    }

    @Test
    void changingOnlyBenefitFormattingIsStillAReadableChange() {
        var company = com.assurance.entity.CompagnieAssistance.builder().nom("Assistance Monde").build();
        company.setId(10L);
        var product = com.assurance.entity.ProduitAssistance.builder().compagnieAssistance(company).libelle("Voyage Monde")
                .type("Assistance Voyage").prestations("<p>Couverture voyage</p>").build();
        product.setId(20L);
        var before = CompanyCatalogueActivity.state(product);
        product.setPrestations("<p><strong>Couverture voyage</strong></p>");

        var command = CompanyCatalogueActivity.command(before, CompanyCatalogueActivity.state(product), ActivityAction.UPDATED,
                "Produit d'assistance modifie", "ASSISTANCE_PRODUCT_UPDATE");

        assertThat(command.changes()).containsExactly(new ActivityChange("Presentation des prestations", null, "Actualisee"));
        assertThat(before.values()).containsEntry("Prestations", "Couverture voyage");
    }

    @Test
    void repeatingAnUnchangedCompanySaveIsNotAnotherActivity() {
        TenantContext.setCurrentUser(9L);
        var actor = Utilisateur.builder().role(Role.builder()
                .permissions(java.util.Set.of(Permission.builder().code("referentiel:manage").build())).build()).build();
        when(users.findById(9L)).thenReturn(Optional.of(actor));
        var company = com.assurance.entity.CompagnieAssurance.builder().code("ATL").nom("Compagnie Atlas").build();
        company.setId(4L);
        var state = CompanyCatalogueActivity.state(company);

        recorder.recordGlobalReference(CompanyCatalogueActivity.command(state, state, ActivityAction.UPDATED,
                "Compagnie modifiee", "INSURANCE_COMPANY_UPDATE"));

        verifyNoInteractions(repository, agencies);
    }

    @Test
    void recreatedGridRowsWithIdenticalBusinessStateAreNotModifications() {
        var company = com.assurance.entity.CompagnieAssurance.builder().nom("Compagnie Atlas").build();
        company.setId(4L);
        var grid = com.assurance.entity.GrilleTarifaire.builder().compagnieAssurance(company).libelle("Tourisme").build();
        grid.setId(10L);
        var usage = com.assurance.entity.Usage.builder().code("A").libelle("Tourisme").build();
        usage.setId(1L);
        var guarantee = com.assurance.entity.Garantie.builder().code("RC").libelle("Responsabilite civile").build();
        guarantee.setId(1L);
        var original = com.assurance.entity.LigneGrilleTarifaire.builder().grilleTarifaire(grid).usage(usage).garantie(guarantee)
                .libelleOption("Standard").prime(new java.math.BigDecimal("100.0")).build();
        original.setId(20L);
        var replacement = com.assurance.entity.LigneGrilleTarifaire.builder().grilleTarifaire(grid).usage(usage).garantie(guarantee)
                .libelleOption("Standard").prime(new java.math.BigDecimal("100.00")).build();
        replacement.setId(21L);
        var before = GridCatalogueActivity.configuration(grid, usage, List.of(original), List.of());
        var after = GridCatalogueActivity.configuration(grid, usage, List.of(replacement), List.of());

        assertThat(GridCatalogueActivity.configurationCommand(before, after).changes()).isEmpty();

        replacement.setPrime(new java.math.BigDecimal("120.00"));
        var changed = GridCatalogueActivity.configurationCommand(before,
                GridCatalogueActivity.configuration(grid, usage, List.of(replacement), List.of()));
        assertThat(changed.changes()).isNotEmpty();
        assertThat(changed.references()).anySatisfy(reference -> {
            assertThat(reference.type()).isEqualTo(ActivityRecordType.LIGNE_GRILLE_TARIFAIRE);
            assertThat(reference.id()).isEqualTo("20");
        });
    }

    @Test
    void choosingAnotherReferenceWithTheSameLabelIsNotANoOp() {
        var oldCompany = com.assurance.entity.CompagnieAssistance.builder().nom("Assistance Monde").build();
        oldCompany.setId(10L);
        var newCompany = com.assurance.entity.CompagnieAssistance.builder().nom("Assistance Monde").build();
        newCompany.setId(11L);
        var product = com.assurance.entity.ProduitAssistance.builder().compagnieAssistance(oldCompany).libelle("Voyage Monde").build();
        product.setId(20L);
        var before = CompanyCatalogueActivity.state(product);
        product.setCompagnieAssistance(newCompany);

        var command = CompanyCatalogueActivity.command(before, CompanyCatalogueActivity.state(product), ActivityAction.UPDATED,
                "Produit d'assistance modifie", "ASSISTANCE_PRODUCT_UPDATE");

        assertThat(command.changes()).containsExactly(new ActivityChange("References associees", null, "Actualisees"));
        assertThat(command.references()).extracting(ActivityReference::id).contains("10", "11");
    }

    private ActivityCommand command(Long agencyId, ActivityAction action, List<ActivityChange> changes) {
        return new ActivityCommand(agencyId, ActivityModule.PRODUCTION, action,
                "Contrat enregistre", "CONTRACT_CREATION",
                ActivityReference.of(ActivityRecordType.CONTRAT, 100L, "MATU26-0027"), List.of(), changes);
    }
}
