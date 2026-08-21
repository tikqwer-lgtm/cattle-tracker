# Облачная среда Cursor: JDK 17 + Android SDK 34 (сборка debug APK).
# Не копировать проект — Cursor сам монтирует репозиторий.
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    openjdk-17-jdk-headless \
    python3 \
    unzip \
    wget \
    zip \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

ENV PATH="${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools"

ARG CMDLINE_TOOLS_ZIP=commandlinetools-linux-11076708_latest.zip

RUN mkdir -p "${ANDROID_HOME}/cmdline-tools" \
  && wget -q "https://dl.google.com/android/repository/${CMDLINE_TOOLS_ZIP}" -O /tmp/cmdtools.zip \
  && unzip -q /tmp/cmdtools.zip -d /tmp/cmdtools \
  && mv /tmp/cmdtools/cmdline-tools "${ANDROID_HOME}/cmdline-tools/latest" \
  && rm -rf /tmp/cmdtools.zip /tmp/cmdtools \
  && yes | sdkmanager --sdk_root="${ANDROID_HOME}" --licenses >/dev/null \
  && sdkmanager --sdk_root="${ANDROID_HOME}" \
    "platform-tools" \
    "platforms;android-34" \
    "build-tools;34.0.0" \
  && chmod -R a+rX "${ANDROID_HOME}" \
  && chmod -R a+w "${ANDROID_HOME}"
