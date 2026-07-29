package com.assurance.service;

import com.assurance.dto.request.CreateClientRequest;
import com.assurance.dto.response.ClientResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.CategorieClient;
import com.assurance.entity.Client;
import com.assurance.entity.ClientTelephone;
import com.assurance.entity.Ville;
import com.assurance.enums.TypeClient;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.CategorieClientRepository;
import com.assurance.repository.ClientRepository;
import com.assurance.repository.ClientTelephoneRepository;
import com.assurance.repository.VilleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ClientService {

    private final AgenceRepository agenceRepository;
    private final ClientRepository clientRepository;
    private final ClientTelephoneRepository clientTelephoneRepository;
    private final VilleRepository villeRepository;
    private final CategorieClientRepository categorieClientRepository;
    private final GroupeClientService groupeClientService;

    @Transactional
    public ClientResponse create(CreateClientRequest request) {
        validateStandaloneClient(request);
        Client client = createEntity(request);
        if (request.getGroupeClientId() != null) {
            groupeClientService.assign(
                    request.getAgenceId(),
                    client.getId(),
                    request.getGroupeClientId(),
                    request.getRelationGroupe(),
                    true,
                    LocalDate.now()
            );
        }
        return toResponse(client);
    }

    private void validateStandaloneClient(CreateClientRequest request) {
        if (request.getTypeClient() == TypeClient.PERSONNE_PHYSIQUE) {
            if (isBlank(request.getCivilite()) || isBlank(request.getPrenom()) || isBlank(request.getNom())
                    || isBlank(request.getCin()) || request.getCinValidite() == null) {
                throw new BadRequestException("La civilité, le nom, le prénom, le CIN et sa validité sont obligatoires");
            }
        } else if (request.getTypeClient() == TypeClient.PERSONNE_MORALE
                && (isBlank(request.getRaisonSociale()) || isBlank(request.getRc()))) {
            throw new BadRequestException("La raison sociale et le RC sont obligatoires");
        }
        if (request.getVilleId() == null || isBlank(request.getAdresse()) || isBlank(request.getTelephone())) {
            throw new BadRequestException("La ville, l'adresse et le téléphone sont obligatoires");
        }
    }

    @Transactional(readOnly = true)
    public Optional<ClientResponse> searchByIdentity(Long agenceId, String cin, String rc) {
        if (agenceId == null) {
            throw new BadRequestException("L'agence est obligatoire");
        }
        if (cin != null && !cin.isBlank()) {
            return clientRepository.findFirstByAgenceIdAndCinIgnoreCase(agenceId, cin.trim())
                    .map(this::toResponse);
        }
        if (rc != null && !rc.isBlank()) {
            return clientRepository.findFirstByAgenceIdAndRcIgnoreCase(agenceId, rc.trim())
                    .map(this::toResponse);
        }
        return Optional.empty();
    }

    @Transactional
    public Client createEntity(CreateClientRequest request) {
        if (request.getAgenceId() == null) {
            throw new BadRequestException("L'agence est obligatoire");
        }
        if (request.getTypeClient() == null) {
            throw new BadRequestException("Le type client est obligatoire");
        }
        assertIdentityAvailable(request.getAgenceId(), null, request);
        Agence agence = agenceRepository.findById(request.getAgenceId())
                .orElseThrow(() -> new ResourceNotFoundException("Agence", request.getAgenceId()));
        Client clientParent = request.getClientParentId() == null ? null :
                clientRepository.findByAgenceIdAndId(request.getAgenceId(), request.getClientParentId())
                        .orElseThrow(() -> new ResourceNotFoundException("Client parent", request.getClientParentId()));
        Ville ville = request.getVilleId() == null ? null :
                villeRepository.findById(request.getVilleId())
                        .orElseThrow(() -> new ResourceNotFoundException("Ville", request.getVilleId()));
        CategorieClient categorieClient = request.getCategorieClientId() == null ? null :
                categorieClientRepository.findById(request.getCategorieClientId())
                        .orElseThrow(() -> new ResourceNotFoundException("CategorieClient", request.getCategorieClientId()));
        if (Boolean.TRUE.equals(request.getSahara()) && (ville == null || !Boolean.TRUE.equals(ville.getSaharienne()))) {
            throw new BadRequestException("La reduction saharienne n'est disponible que pour une ville saharienne");
        }
        String telephonePrincipal = resolveTelephonePrincipal(request);
        Client client = Client.builder()
                .agence(agence)
                .clientParent(clientParent)
                .ville(ville)
                .categorieClient(categorieClient)
                .typeClient(request.getTypeClient())
                .codeClient(request.getCodeClient())
                .civilite(request.getCivilite())
                .prenom(request.getPrenom())
                .nom(request.getNom())
                .raisonSociale(request.getRaisonSociale())
                .cin(request.getCin())
                .rc(request.getRc())
                .ice(request.getIce())
                .numeroPermis(request.getNumeroPermis())
                .dateDelivrancePermis(request.getDateDelivrancePermis())
                .dateValiditePermis(request.getDateValiditePermis())
                .dateNaissance(request.getDateNaissance())
                .adresse(request.getAdresse())
                .telephone(telephonePrincipal)
                .email(request.getEmail())
                .cinValidite(request.getCinValidite())
                .nationalite(request.getNationalite())
                .passport(request.getPassport())
                .carteResidence(request.getCarteResidence())
                .iff(request.getIff())
                .patente(request.getPatente())
                .cnss(request.getCnss())
                .conducteurHabituel(request.getConducteurHabituel() == null ? true : request.getConducteurHabituel())
                .sahara(request.getSahara() == null ? false : request.getSahara())
                .justificatifSahara(request.getJustificatifSahara())
                .build();
        client = clientRepository.save(client);
        saveTelephones(client, request);
        return client;
    }

    @Transactional
    public Client updateEntity(Long agenceId, Long clientId, CreateClientRequest request) {
        Client client = clientRepository.findByAgenceIdAndId(agenceId, clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Client", clientId));
        assertIdentityAvailable(agenceId, clientId, request);
        applyRequest(client, request);
        client = clientRepository.save(client);
        clientTelephoneRepository.deleteAll(client.getTelephones());
        client.getTelephones().clear();
        saveTelephones(client, request);
        return client;
    }

    private void assertIdentityAvailable(Long agenceId, Long currentClientId, CreateClientRequest request) {
        if (request.getCin() != null && !request.getCin().isBlank()) {
            clientRepository.findFirstByAgenceIdAndCinIgnoreCase(agenceId, request.getCin().trim())
                    .filter(existing -> !existing.getId().equals(currentClientId))
                    .ifPresent(existing -> {
                        throw new BadRequestException("Un client avec ce CIN existe déjà");
                    });
        }
        if (request.getRc() != null && !request.getRc().isBlank()) {
            clientRepository.findFirstByAgenceIdAndRcIgnoreCase(agenceId, request.getRc().trim())
                    .filter(existing -> !existing.getId().equals(currentClientId))
                    .ifPresent(existing -> {
                        throw new BadRequestException("Un client avec ce RC existe déjà");
                    });
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    public ClientResponse toResponse(Client client) {
        var telephones = client.getTelephones() == null ? java.util.List.<ClientResponse.TelephoneView>of() :
                client.getTelephones().stream()
                        .map(telephone -> ClientResponse.TelephoneView.builder()
                                .id(telephone.getId())
                                .numero(telephone.getNumero())
                                .whatsapp(telephone.getWhatsapp())
                                .principal(telephone.getPrincipal())
                                .build())
                        .toList();
        return ClientResponse.builder()
                .id(client.getId())
                .agenceId(client.getAgence() != null ? client.getAgence().getId() : null)
                .clientParentId(client.getClientParent() != null ? client.getClientParent().getId() : null)
                .typeClient(client.getTypeClient())
                .codeClient(client.getCodeClient())
                .nomAffichage(client.getNomAffichage())
                .civilite(client.getCivilite())
                .prenom(client.getPrenom())
                .nom(client.getNom())
                .raisonSociale(client.getRaisonSociale())
                .cin(client.getCin())
                .rc(client.getRc())
                .ice(client.getIce())
                .numeroPermis(client.getNumeroPermis())
                .cinValidite(client.getCinValidite())
                .dateDelivrancePermis(client.getDateDelivrancePermis())
                .dateValiditePermis(client.getDateValiditePermis())
                .dateNaissance(client.getDateNaissance())
                .adresse(client.getAdresse())
                .villeId(client.getVille() != null ? client.getVille().getId() : null)
                .ville(client.getVille() != null ? client.getVille().getNom() : null)
                .villeSaharienne(client.getVille() != null ? client.getVille().getSaharienne() : null)
                .categorieClientId(client.getCategorieClient() != null ? client.getCategorieClient().getId() : null)
                .categorieClientCode(client.getCategorieClient() != null ? client.getCategorieClient().getCode() : null)
                .categorieClientLibelle(client.getCategorieClient() != null ? client.getCategorieClient().getLibelle() : null)
                .telephone(client.getTelephone())
                .email(client.getEmail())
                .nationalite(client.getNationalite())
                .passport(client.getPassport())
                .carteResidence(client.getCarteResidence())
                .iff(client.getIff())
                .patente(client.getPatente())
                .cnss(client.getCnss())
                .conducteurHabituel(client.getConducteurHabituel())
                .sahara(client.getSahara())
                .justificatifSahara(client.getJustificatifSahara())
                .actif(client.getActif())
                .telephones(telephones)
                .groupe(groupeClientService.activePrincipalMembership(
                        client.getAgence().getId(),
                        client.getId()
                ))
                .build();
    }

    private void applyRequest(Client client, CreateClientRequest request) {
        if (request.getTypeClient() == null) {
            throw new BadRequestException("Le type client est obligatoire");
        }
        Long agenceId = client.getAgence().getId();
        Client clientParent = request.getClientParentId() == null ? null :
                clientRepository.findByAgenceIdAndId(agenceId, request.getClientParentId())
                        .orElseThrow(() -> new ResourceNotFoundException("Client parent", request.getClientParentId()));
        Ville ville = request.getVilleId() == null ? null :
                villeRepository.findById(request.getVilleId())
                        .orElseThrow(() -> new ResourceNotFoundException("Ville", request.getVilleId()));
        CategorieClient categorieClient = request.getCategorieClientId() == null ? null :
                categorieClientRepository.findById(request.getCategorieClientId())
                        .orElseThrow(() -> new ResourceNotFoundException("CategorieClient", request.getCategorieClientId()));
        if (Boolean.TRUE.equals(request.getSahara()) && (ville == null || !Boolean.TRUE.equals(ville.getSaharienne()))) {
            throw new BadRequestException("La reduction saharienne n'est disponible que pour une ville saharienne");
        }
        client.setClientParent(clientParent);
        client.setVille(ville);
        client.setCategorieClient(categorieClient);
        client.setTypeClient(request.getTypeClient());
        client.setCodeClient(request.getCodeClient());
        client.setCivilite(request.getCivilite());
        client.setPrenom(request.getPrenom());
        client.setNom(request.getNom());
        client.setRaisonSociale(request.getRaisonSociale());
        client.setCin(request.getCin());
        client.setRc(request.getRc());
        client.setIce(request.getIce());
        client.setNumeroPermis(request.getNumeroPermis());
        client.setDateDelivrancePermis(request.getDateDelivrancePermis());
        client.setDateValiditePermis(request.getDateValiditePermis());
        client.setDateNaissance(request.getDateNaissance());
        client.setAdresse(request.getAdresse());
        client.setTelephone(resolveTelephonePrincipal(request));
        client.setEmail(request.getEmail());
        client.setCinValidite(request.getCinValidite());
        client.setNationalite(request.getNationalite());
        client.setPassport(request.getPassport());
        client.setCarteResidence(request.getCarteResidence());
        client.setIff(request.getIff());
        client.setPatente(request.getPatente());
        client.setCnss(request.getCnss());
        client.setConducteurHabituel(request.getConducteurHabituel() == null ? true : request.getConducteurHabituel());
        client.setSahara(request.getSahara() == null ? false : request.getSahara());
        client.setJustificatifSahara(request.getJustificatifSahara());
    }

    private String resolveTelephonePrincipal(CreateClientRequest request) {
        if (request.getTelephones() == null || request.getTelephones().isEmpty()) {
            return request.getTelephone();
        }
        return request.getTelephones().stream()
                .filter(input -> Boolean.TRUE.equals(input.getPrincipal()))
                .findFirst()
                .or(() -> request.getTelephones().stream().findFirst())
                .map(CreateClientRequest.TelephoneInput::getNumero)
                .orElse(request.getTelephone());
    }

    private void saveTelephones(Client client, CreateClientRequest request) {
        if (request.getTelephones() == null || request.getTelephones().isEmpty()) {
            if (request.getTelephone() == null || request.getTelephone().isBlank()) {
                return;
            }
            ClientTelephone telephone = clientTelephoneRepository.save(ClientTelephone.builder()
                    .client(client)
                    .numero(request.getTelephone())
                    .principal(true)
                    .whatsapp(false)
                    .build());
            client.getTelephones().add(telephone);
            return;
        }

        boolean principalDejaDefini = false;
        for (CreateClientRequest.TelephoneInput input : request.getTelephones()) {
            if (input.getNumero() == null || input.getNumero().isBlank()) {
                throw new BadRequestException("Le numero de telephone est obligatoire");
            }
            boolean principal = Boolean.TRUE.equals(input.getPrincipal()) && !principalDejaDefini;
            principalDejaDefini = principalDejaDefini || principal;
            ClientTelephone telephone = clientTelephoneRepository.save(ClientTelephone.builder()
                    .client(client)
                    .numero(input.getNumero())
                    .principal(principal)
                    .whatsapp(input.getWhatsapp() == null ? false : input.getWhatsapp())
                    .build());
            client.getTelephones().add(telephone);
        }
        if (!principalDejaDefini && !client.getTelephones().isEmpty()) {
            client.getTelephones().get(0).setPrincipal(true);
        }
    }
}
