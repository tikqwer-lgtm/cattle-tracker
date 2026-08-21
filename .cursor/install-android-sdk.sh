#!/usr/bin/env bash
# Идемпотентная подготовка Android SDK для облачного агента / CI.
# Пишет android/local.properties (файл в gitignore).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/opt/android-sdk}}"
SDKMANAGER="${SDK}/cmdline-tools/latest/bin/sdkmanager"

if [[ ! -x "$SDKMANAGER" ]]; then
  SDK="${HOME}/android-sdk"
  SDKMANAGER="${SDK}/cmdline-tools/latest/bin/sdkmanager"
fi

if [[ ! -x "$SDKMANAGER" ]]; then
  echo "Установка Android command-line tools в ${SDK}…"
  mkdir -p "${SDK}/cmdline-tools"
  ZIP=/tmp/commandlinetools.zip
  wget -q "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -O "$ZIP"
  mkdir -p /tmp/cmdtools
  unzip -qo "$ZIP" -d /tmp/cmdtools
  rm -rf "${SDK}/cmdline-tools/latest"
  mv /tmp/cmdtools/cmdline-tools "${SDK}/cmdline-tools/latest"
  rm -rf "$ZIP" /tmp/cmdtools
  yes | "${SDK}/cmdline-tools/latest/bin/sdkmanager" --sdk_root="${SDK}" --licenses >/dev/null || true
  "${SDK}/cmdline-tools/latest/bin/sdkmanager" --sdk_root="${SDK}" \
    "platform-tools" \
    "platforms;android-34" \
    "build-tools;34.0.0"
  SDKMANAGER="${SDK}/cmdline-tools/latest/bin/sdkmanager"
fi

if [[ ! -x "$SDKMANAGER" ]]; then
  echo "Android SDK не найден. Облачная среда: нужен образ из .cursor/Dockerfile (Build в Cloud Agents)."
  exit 1
fi

printf 'sdk.dir=%s\n' "$SDK" > "${ROOT}/android/local.properties"
chmod +x "${ROOT}/android/gradlew" || true

PROFILE="${HOME}/.bashrc"
SNIPPET_START="# cattle-tracker android sdk"
if [[ -f "$PROFILE" ]] && grep -q "$SNIPPET_START" "$PROFILE"; then
  :
else
  {
    echo ""
    echo "$SNIPPET_START"
    echo "export ANDROID_HOME=\"${SDK}\""
    echo "export ANDROID_SDK_ROOT=\"${SDK}\""
    echo "export PATH=\"\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$PATH\""
  } >> "$PROFILE"
fi

echo "Android SDK: $SDK"
echo "android/local.properties записан."
