package com.assurance.seeder;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.stream.Collectors;

@Component
@Order(3)
@RequiredArgsConstructor
public class TarifUsageSeeder implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    @Transactional
    public void run(String... args) {
        String sql = readBundledSql("data/tarifs_usage.sql");
        if (sql == null || sql.isBlank()) {
            return;
        }

        String executableSql = sql.lines()
                .filter(line -> !line.trim().startsWith("--"))
                .collect(Collectors.joining("\n"));

        Arrays.stream(executableSql.split(";"))
                .map(String::trim)
                .filter(statement -> !statement.isBlank())
                .forEach(jdbcTemplate::execute);
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
}
