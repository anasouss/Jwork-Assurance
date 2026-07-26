package com.assurance.seeder;

import com.assurance.entity.TypeMouvementContrat;
import com.assurance.entity.TypePieceJointe;
import com.assurance.enums.TypeClient;
import com.assurance.enums.TypeContrat;
import com.assurance.repository.TypeMouvementContratRepository;
import com.assurance.repository.TypePieceJointeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(4)
@RequiredArgsConstructor
public class PieceJointeTypeSeeder implements CommandLineRunner {

    private final TypeMouvementContratRepository typeMouvementContratRepository;
    private final TypePieceJointeRepository typePieceJointeRepository;

    @Override
    @Transactional
    public void run(String... args) {
        if (typePieceJointeRepository.count() > 0) {
            return;
        }

        TypeMouvementContrat affaireNouvelle = movement("AN");
        TypeMouvementContrat renouvellement = movement("REN");
        TypeMouvementContrat extensionGaranties = movement("EXG_M");
        TypeMouvementContrat modificationGaranties = movement("MOG_M");
        TypeMouvementContrat changementVehicule = movement("CHV_M");
        TypeMouvementContrat extensionRemorque = movement("EXR_M");
        TypeMouvementContrat precisionMono = movement("PRI_M");
        TypeMouvementContrat duplicataMono = movement("DUP_M");
        TypeMouvementContrat provisoire = movement("PRO_M");
        TypeMouvementContrat resiliationMono = movement("RES_M");
        TypeMouvementContrat resiliationEcheance = movement("RCH_M");
        TypeMouvementContrat annulation = movement("ANN_M");
        TypeMouvementContrat incorporation = movement("INC_F");
        TypeMouvementContrat retrait = movement("RET_F");
        TypeMouvementContrat resiliationFlotte = movement("RES_F");
        TypeMouvementContrat precisionFlotte = movement("PRI_F");
        TypeMouvementContrat duplicataFlotte = movement("DUP_F");

        seed("CIN", null, TypeClient.PERSONNE_PHYSIQUE, affaireNouvelle, true, 10);
        seed("Permis de conduire", null, TypeClient.PERSONNE_PHYSIQUE, affaireNouvelle, true, 20);
        seed("Registre de commerce", null, TypeClient.PERSONNE_MORALE, affaireNouvelle, true, 30);
        seed("ICE", null, TypeClient.PERSONNE_MORALE, affaireNouvelle, false, 40);
        seed("Statuts", null, TypeClient.PERSONNE_MORALE, affaireNouvelle, false, 50);
        seed("Carte grise", null, null, affaireNouvelle, true, 60);
        seed("Visite technique", null, null, affaireNouvelle, false, 70);
        seed("Bon de commande", null, null, affaireNouvelle, false, 80);
        seed("Contrat de credit", null, null, affaireNouvelle, false, 90);
        seed("Mandat ou procuration", null, null, affaireNouvelle, false, 100);

        seed("Attestation precedente", null, null, renouvellement, true, 110);
        seed("Police precedente", null, null, renouvellement, false, 120);
        seed("Quittance precedente", null, null, renouvellement, false, 130);
        seed("Carte grise", null, null, renouvellement, false, 140);

        seed("Demande d'avenant", null, null, extensionGaranties, true, 150);
        seed("Demande d'avenant", null, null, modificationGaranties, true, 160);
        seed("Situation garanties precedente", null, null, extensionGaranties, false, 170);
        seed("Situation garanties precedente", null, null, modificationGaranties, false, 180);

        seed("Demande de changement vehicule", null, null, changementVehicule, true, 190);
        seed("Carte grise nouveau vehicule", null, null, changementVehicule, true, 200);
        seed("Carte grise ancien vehicule", null, null, changementVehicule, false, 210);
        seed("Attestation originale", null, null, changementVehicule, false, 220);

        seed("Demande d'extension remorque", null, null, extensionRemorque, true, 230);
        seed("Carte grise remorque", null, null, extensionRemorque, true, 240);
        seed("Justificatif PTC remorque", null, null, extensionRemorque, false, 250);

        seed("Demande de precision", null, null, precisionMono, true, 260);
        seed("Carte grise definitive", null, null, precisionMono, true, 270);
        seed("Attestation provisoire", null, null, precisionMono, false, 280);

        seed("Demande de duplicata", null, null, duplicataMono, true, 290);
        seed("Declaration de perte", null, null, duplicataMono, true, 300);
        seed("CIN", null, TypeClient.PERSONNE_PHYSIQUE, duplicataMono, false, 310);
        seed("Registre de commerce", null, TypeClient.PERSONNE_MORALE, duplicataMono, false, 320);

        seed("Demande de provisoire", null, null, provisoire, true, 330);
        seed("Carte grise provisoire", null, null, provisoire, true, 340);
        seed("Bon de commande", null, null, provisoire, false, 350);

        seed("Demande de resiliation", null, null, resiliationMono, true, 360);
        seed("Demande de resiliation a l'echeance", null, null, resiliationEcheance, true, 370);
        seed("Demande d'annulation", null, null, annulation, true, 380);
        seed("Attestation originale", null, null, resiliationMono, false, 390);
        seed("Attestation originale", null, null, resiliationEcheance, false, 400);
        seed("Attestation originale", null, null, annulation, false, 410);
        seed("RIB", null, null, resiliationMono, false, 420);
        seed("Justificatif de vente", null, null, resiliationMono, false, 430);

        seed("Demande d'incorporation", TypeContrat.FLOTTE, null, incorporation, true, 440);
        seed("Liste des vehicules", TypeContrat.FLOTTE, null, incorporation, true, 450);
        seed("Carte grise", TypeContrat.FLOTTE, null, incorporation, true, 460);
        seed("CIN conducteur", TypeContrat.FLOTTE, TypeClient.PERSONNE_PHYSIQUE, incorporation, false, 470);
        seed("Registre de commerce", TypeContrat.FLOTTE, TypeClient.PERSONNE_MORALE, incorporation, false, 480);

        seed("Demande de retrait", TypeContrat.FLOTTE, null, retrait, true, 490);
        seed("Liste des vehicules retires", TypeContrat.FLOTTE, null, retrait, true, 500);
        seed("Attestation originale", TypeContrat.FLOTTE, null, retrait, false, 510);

        seed("Demande de resiliation", TypeContrat.FLOTTE, null, resiliationFlotte, true, 520);
        seed("Liste des vehicules", TypeContrat.FLOTTE, null, resiliationFlotte, false, 530);
        seed("Attestations originales", TypeContrat.FLOTTE, null, resiliationFlotte, false, 540);

        seed("Demande de precision", TypeContrat.FLOTTE, null, precisionFlotte, true, 550);
        seed("Carte grise definitive", TypeContrat.FLOTTE, null, precisionFlotte, true, 560);
        seed("Liste des vehicules concernes", TypeContrat.FLOTTE, null, precisionFlotte, false, 570);

        seed("Demande de duplicata", TypeContrat.FLOTTE, null, duplicataFlotte, true, 580);
        seed("Declaration de perte", TypeContrat.FLOTTE, null, duplicataFlotte, true, 590);
        seed("Liste des vehicules concernes", TypeContrat.FLOTTE, null, duplicataFlotte, false, 600);

        seed("Autre document", null, null, null, false, 1000);
    }

    private TypeMouvementContrat movement(String code) {
        return typeMouvementContratRepository.findByCodeIgnoreCase(code).orElse(null);
    }

    private void seed(
            String libelle,
            TypeContrat typeContrat,
            TypeClient typeClient,
            TypeMouvementContrat typeMouvement,
            boolean obligatoire,
            int ordreAffichage
    ) {
        typePieceJointeRepository.save(TypePieceJointe.builder()
                .libelle(libelle)
                .typeContrat(typeContrat)
                .typeClient(typeClient)
                .typeMouvement(typeMouvement)
                .obligatoire(obligatoire)
                .ordreAffichage(ordreAffichage)
                .actif(true)
                .build());
    }
}
