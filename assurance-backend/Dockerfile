FROM maven:3.9.9-eclipse-temurin-17 AS build

WORKDIR /app

COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline

COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

RUN apk add --no-cache su-exec \
    && addgroup -S app \
    && adduser -S app -G app \
    && mkdir -p /data/assurance/pieces-jointes \
    && chown -R app:app /data/assurance

COPY --from=build /app/target/*.jar /app/app.jar
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh

ENV JAVA_OPTS=""
ENV PORT=8080
ENV APP_STORAGE_PIECES_JOINTES_DIR=/data/assurance/pieces-jointes
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
