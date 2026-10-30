ARG JAVA_BASE
ARG NODE_BASE
FROM ${JAVA_BASE} AS jdk
FROM ${NODE_BASE}
USER root
COPY --from=jdk /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH=/opt/java/openjdk/bin:$PATH
RUN mkdir -p /opt/research /project && touch /opt/research/container-only && chmod 0555 /project
COPY executor/runner/ /opt/research/
COPY shared/execution-protocol.js /opt/research/protocol.mjs
# Operator supplies a JUnit console standalone jar verified against a trusted checksum.
COPY executor/vendor/junit-platform-console-standalone.jar /opt/research/junit.jar
ARG JUNIT_SHA256
RUN printf '%s  /opt/research/junit.jar\n' "$JUNIT_SHA256" | sha256sum -c -
USER 1000:1000
WORKDIR /project
ENTRYPOINT ["/usr/local/bin/node", "/opt/research/run.mjs"]
