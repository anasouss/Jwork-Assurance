package com.assurance.seeder;

import com.assurance.entity.Carrosserie;
import com.assurance.entity.Marque;
import com.assurance.repository.CarrosserieRepository;
import com.assurance.repository.MarqueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@Order(1)
@RequiredArgsConstructor
public class VehiculeReferentielSeeder implements CommandLineRunner {

    private static final Pattern REFERENTIEL_VALUE = Pattern.compile("\\(\\s*\\d+\\s*,\\s*([01])\\s*,\\s*'((?:\\\\'|[^'])*)'\\s*\\)");

    private final MarqueRepository marqueRepository;
    private final CarrosserieRepository carrosserieRepository;

    @Override
    @Transactional
    public void run(String... args) {
        if (marqueRepository.count() == 0) {
            seedMarques();
        }
        if (carrosserieRepository.count() == 0) {
            seedCarrosseries();
        }
    }

    private void seedMarques() {
        String sql = readBundledSql("data/marques.sql");
        if (sql == null) {
            return;
        }
        Matcher matcher = REFERENTIEL_VALUE.matcher(sql);
        while (matcher.find()) {
            if (!"0".equals(matcher.group(1))) {
                continue;
            }
            String libelle = cleanSqlValue(matcher.group(2));
            if (libelle.isBlank()) {
                continue;
            }
            Marque marque = marqueRepository.findByLibelleIgnoreCase(libelle).orElseGet(() ->
                    marqueRepository.save(Marque.builder()
                            .libelle(libelle)
                            .actif(true)
                            .build())
            );
            if (!Boolean.TRUE.equals(marque.getActif())) {
                marque.setActif(true);
                marqueRepository.save(marque);
            }
        }
    }

    private void seedCarrosseries() {
        String sql = readBundledSql("data/carrosseries.sql");
        if (sql == null) {
            return;
        }
        Matcher matcher = REFERENTIEL_VALUE.matcher(sql);
        while (matcher.find()) {
            if (!"0".equals(matcher.group(1))) {
                continue;
            }
            String libelle = cleanSqlValue(matcher.group(2));
            if (libelle.isBlank()) {
                continue;
            }
            Carrosserie carrosserie = carrosserieRepository.findByLibelleIgnoreCase(libelle).orElseGet(() ->
                    carrosserieRepository.save(Carrosserie.builder()
                            .libelle(libelle)
                            .actif(true)
                            .build())
            );
            if (!Boolean.TRUE.equals(carrosserie.getActif())) {
                carrosserie.setActif(true);
                carrosserieRepository.save(carrosserie);
            }
        }
    }

    private String readBundledSql(String path) {
        ClassPathResource resource = new ClassPathResource(path);
        if (!resource.exists()) {
            return null;
        }
        try (InputStream inputStream = resource.getInputStream()) {
            return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException ignored) {
            return null;
        }
    }

    private String cleanSqlValue(String value) {
        return value.replace("\\'", "'").trim();
    }
}
