package com.assurance.activity;

import com.assurance.entity.BusinessActivity;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.BusinessActivityRepository;
import com.assurance.repository.BusinessActivitySearchRepositoryImpl;
import com.assurance.repository.UtilisateurRepository;
import com.assurance.security.TenantContext;
import com.assurance.security.UserPrincipal;
import com.assurance.service.BusinessActivityService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BusinessActivityTransactionTest {
    private AnnotationConfigApplicationContext context;
    private JdbcTemplate jdbc;
    private BusinessActivityRecorder recorder;
    private TransactionTemplate transaction;

    @BeforeEach
    void setup() {
        TenantContext.clear();
        context = new AnnotationConfigApplicationContext(TestConfig.class);
        jdbc = context.getBean(JdbcTemplate.class);
        jdbc.execute("CREATE TABLE business_operation_test (id BIGINT PRIMARY KEY)");
        jdbc.execute("CREATE TABLE business_activity_test (title VARCHAR(240))");
        recorder = context.getBean(BusinessActivityRecorder.class);
        transaction = new TransactionTemplate(context.getBean(PlatformTransactionManager.class));
    }

    @AfterEach
    void close() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
        context.close();
    }

    @Test
    void activityAndBusinessWriteRollbackTogetherEvenWhenActivityWasAlreadySaved() {
        assertThatThrownBy(() -> transaction.executeWithoutResult(status -> {
            jdbc.update("INSERT INTO business_operation_test VALUES (1)");
            recorder.record(command());
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM business_activity_test", Long.class)).isEqualTo(1L);
            throw new IllegalStateException("Failure after activity persistence");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM business_operation_test", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM business_activity_test", Long.class)).isZero();

        transaction.executeWithoutResult(status -> recorder.perform(() -> {
            jdbc.update("INSERT INTO business_operation_test VALUES (2)");
            return "ok";
        }, result -> command()));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM business_operation_test", Long.class)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM business_activity_test", Long.class)).isEqualTo(1L);
    }

    @Test
    void recorderCannotCommitAnActivityOutsideTheDomainTransaction() {
        assertThatThrownBy(() -> recorder.record(command())).isInstanceOf(IllegalTransactionStateException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM business_activity_test", Long.class)).isZero();
    }

    @Test
    @SuppressWarnings("unchecked")
    void actualJpaProjectionKeepsNullableReferencesAndAppliesAgencyFiltersWithoutLoadingChanges() {
        jdbc.execute("CREATE TABLE agences (id BIGINT PRIMARY KEY)");
        jdbc.execute("CREATE TABLE users (id BIGINT PRIMARY KEY)");
        jdbc.execute("INSERT INTO agences VALUES (1), (2)");
        jdbc.execute("INSERT INTO users VALUES (9)");
        jdbc.execute("""
                CREATE TABLE business_activities (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    agence_id BIGINT, actor_user_id BIGINT, actor_name VARCHAR(220), occurred_at TIMESTAMP,
                    module VARCHAR(40), activity_action VARCHAR(30), title VARCHAR(240), origin VARCHAR(100),
                    surface VARCHAR(40), subject_type VARCHAR(40), subject_id VARCHAR(80), subject_label VARCHAR(500),
                    references_json CLOB, changes_json CLOB, request_id VARCHAR(80)
                )
                """);
        List<String> statements = new ArrayList<>();
        var factory = new LocalContainerEntityManagerFactoryBean();
        factory.setDataSource(context.getBean(DataSource.class));
        factory.setPackagesToScan("com.assurance.entity");
        factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "none",
                "hibernate.session_factory.statement_inspector", (org.hibernate.resource.jdbc.spi.StatementInspector) sql -> {
                    statements.add(sql);
                    return sql;
                }));
        factory.afterPropertiesSet();
        var entityManager = java.util.Objects.requireNonNull(factory.getObject()).createEntityManager();
        try {
            entityManager.getTransaction().begin();
            entityManager.persist(projectionEvent(entityManager, 1L, 9L, "Client_100%"));
            entityManager.persist(projectionEvent(entityManager, 1L, null, "ClientX100abc"));
            entityManager.persist(projectionEvent(entityManager, 2L, 9L, "Autre agence"));
            entityManager.persist(projectionEvent(entityManager, null, null, "Parametre plateforme"));
            entityManager.persist(projectionEvent(entityManager, 1L, null, "Operateur supprime"));
            entityManager.getTransaction().commit();
            entityManager.clear();

            var projection = new BusinessActivitySearchRepositoryImpl(entityManager);
            var repository = mock(BusinessActivityRepository.class);
            when(repository.searchSummaries(any(), any(Pageable.class))).thenAnswer(call ->
                    projection.searchSummaries(call.getArgument(0, Specification.class), call.getArgument(1, Pageable.class)));
            var service = new BusinessActivityService(repository, new ObjectMapper());
            statements.clear();
            activityReader("AGENCY_ADMIN", 1L);
            var agency = service.search(null, null, null, null, null, null, null, null, 0, 25);
            assertThat(agency.getPage().getTotalElements()).isEqualTo(3);
            assertThat(agency.getItems()).allSatisfy(event -> {
                assertThat(event.agenceId()).isEqualTo(1L);
                assertThat(event.changes()).isEmpty();
            });
            assertThat(agency.getItems()).extracting(event -> event.actorUserId()).containsExactly(null, null, 9L);
            assertThat(service.search(null, null, null, null, null, null, null, "Client_100%", 0, 25).getItems()).hasSize(1);
            assertThat(service.search(null, null, null, null, 9L, null, null, null, 0, 25).getItems()).hasSize(1);

            activityReader("SUPER_ADMIN", null);
            var platform = service.search(null, null, null, null, null, null, null, null, 0, 2);
            assertThat(platform.getPage().getTotalElements()).isEqualTo(5);
            assertThat(platform.getItems()).hasSize(2).anySatisfy(event -> {
                assertThat(event.agenceId()).isNull();
                assertThat(event.actorUserId()).isNull();
            });
            var secondPage = service.search(null, null, null, null, null, null, null, null, 1, 2);
            assertThat(secondPage.getItems()).hasSize(2);
            assertThat(secondPage.getItems()).extracting(event -> event.id())
                    .doesNotContainAnyElementsOf(platform.getItems().stream().map(event -> event.id()).toList());
            assertThat(statements).isNotEmpty().allSatisfy(sql -> assertThat(sql.toLowerCase(java.util.Locale.ROOT)).doesNotContain("changes_json"));
        } finally {
            entityManager.close();
            factory.destroy();
        }
    }

    private BusinessActivity projectionEvent(jakarta.persistence.EntityManager entityManager, Long agencyId, Long actorId, String label) {
        return BusinessActivity.builder()
                .agence(agencyId == null ? null : entityManager.getReference(com.assurance.entity.Agence.class, agencyId))
                .actor(actorId == null ? null : entityManager.getReference(com.assurance.entity.Utilisateur.class, actorId))
                .actorName("Operateur historique").occurredAt(LocalDateTime.of(2026, 11, 6, 12, 0))
                .module(ActivityModule.ADMINISTRATION).action(ActivityAction.SAVED).title("Operation enregistree")
                .origin("PROJECTION_TEST").surface(ActivitySurface.ADMINISTRATION).subjectType(ActivityRecordType.PARAMETRE)
                .subjectId(label).subjectLabel(label).referencesJson("[]").changesJson("[{\"label\":\"Information\",\"afterValue\":\"Detail\"}]").build();
    }

    private void activityReader(String role, Long agencyId) {
        var reader = new UserPrincipal(9L, "admin@example.test", "", role, agencyId, true, Set.of("activity:view"));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(reader, null, reader.getAuthorities()));
        TenantContext.setCurrentAgence(agencyId);
    }

    private ActivityCommand command() {
        return new ActivityCommand(null, ActivityModule.ADMINISTRATION, ActivityAction.SAVED,
                "Operation enregistree", "TRANSACTION_TEST", new ActivityReference(ActivityRecordType.PARAMETRE, "TEST", "Test"),
                List.of(), List.of(new ActivityChange("Valeur", "Avant", "Apres")));
    }

    @TestConfiguration(proxyBeanMethods = false)
    @EnableTransactionManagement
    static class TestConfig {
        @Bean
        DataSource dataSource() {
            return new DriverManagerDataSource("jdbc:h2:mem:activity-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
        }

        @Bean
        JdbcTemplate jdbcTemplate(DataSource dataSource) {
            return new JdbcTemplate(dataSource);
        }

        @Bean
        PlatformTransactionManager transactionManager(DataSource dataSource) {
            return new DataSourceTransactionManager(dataSource);
        }

        @Bean
        BusinessActivityRecorder businessActivityRecorder(JdbcTemplate jdbc) {
            BusinessActivityRepository events = mock(BusinessActivityRepository.class);
            when(events.save(any(BusinessActivity.class))).thenAnswer(call -> {
                BusinessActivity event = call.getArgument(0);
                jdbc.update("INSERT INTO business_activity_test (title) VALUES (?)", event.getTitle());
                return event;
            });
            return new BusinessActivityRecorder(events, mock(AgenceRepository.class), mock(UtilisateurRepository.class), new ObjectMapper());
        }
    }
}
