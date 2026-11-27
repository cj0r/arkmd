#!/usr/bin/env bash
# Build the ArkMD F-Droid repository (index plus APKs) into a folder ready to publish.
#
#   tools/build_fdroid_repo.sh APK_DIR OUT_DIR
#
# APK_DIR holds the release APKs (ArkMD-<version>-android-arm64.apk). OUT_DIR receives fdroid/repo/ (the repository) and
# index.html (a page with the address to add). Needs fdroidserver (pip install fdroidserver) and the repository signing key:
#   FDROID_KEYSTORE        path to the PKCS12 keystore
#   FDROID_KEY_STORE_PASS  its password (the key uses the same one)
#   ANDROID_HOME           the Android SDK, whose build-tools provide apksigner
set -euo pipefail

apks=${1:?APK folder}
out=${2:?output folder}
root=$(cd "$(dirname "$0")/.." && pwd)
: "${FDROID_KEYSTORE:?set FDROID_KEYSTORE}" "${FDROID_KEY_STORE_PASS:?set FDROID_KEY_STORE_PASS}"
export FDROID_KEY_PASS=${FDROID_KEY_PASS:-$FDROID_KEY_STORE_PASS}

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/repo" "$work/metadata/app.arkmd"
cp "$root/fdroid/config.yml" "$work/config.yml"
cp "$root/fdroid/metadata/app.arkmd.yml" "$work/metadata/app.arkmd.yml"
# The recommended version is the newest final release. A beta (ArkMD-1.2.3-4-android-arm64.apk) has a higher version code
# than it, so the F-Droid client offers it only to people who allow beta updates; without this line the highest code wins.
cvc=$(for f in "$apks"/ArkMD-*-android-arm64.apk; do v=${f##*/ArkMD-}; v=${v%-android-arm64.apk}; case $v in *-*) ;; *) echo "$v" ;; esac; done \
  | sort -V | tail -n1 | awk -F. 'NF==3 {print $1*1000000+$2*1000+$3}')
[ -n "$cvc" ] && printf 'CurrentVersionCode: %s\n' "$cvc" >> "$work/metadata/app.arkmd.yml"
cp -r "$root/fastlane/metadata/android/en-US" "$work/metadata/app.arkmd/en-US"
cp "$root/docs/logo/icon.png" "$work/icon.png"
cp "$apks"/ArkMD-*-android-arm64.apk "$work/repo/"
cp "$FDROID_KEYSTORE" "$work/keystore.p12"
printf 'keystore: keystore.p12\nkeystorepass: %s\nkeypass: %s\n' "$FDROID_KEY_STORE_PASS" "$FDROID_KEY_PASS" > "$work/config-secrets.yml"
chmod 600 "$work/config-secrets.yml"
# fdroidserver reads one config file, so append the secret part to a private copy of the config
cat "$work/config-secrets.yml" >> "$work/config.yml"
# apksigner (from the Android build tools) signs the index
: "${ANDROID_HOME:?set ANDROID_HOME to the Android SDK}"
printf 'sdk_path: %s\n' "$ANDROID_HOME" >> "$work/config.yml"
chmod 600 "$work/config.yml"

(cd "$work" && fdroid update --pretty 2>&1 | tail -n 25)

mkdir -p "$out/fdroid"
rm -rf "$out/fdroid/repo"
cp -r "$work/repo" "$out/fdroid/repo"
# the repository must not contain the config or key
rm -f "$out/fdroid/repo/"*.yml 2>/dev/null || true
python3 "$root/tools/fdroid_page.py" "$out/fdroid/repo" "$out/index.html"
