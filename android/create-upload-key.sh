#!/bin/bash
# Creates SafaKing's Google Play upload key. Run it yourself, once:
#
#   bash android/create-upload-key.sh
#
# You choose the password; it is typed hidden and never printed. The key goes
# to ~/SafaKing-keys (outside git), and android/keystore.properties — also
# kept out of git — tells the release build where it is.
set -euo pipefail
cd "$(dirname "$0")"

KEYDIR="$HOME/SafaKing-keys"
KEYSTORE="$KEYDIR/safaking-upload.jks"
ALIAS="safaking-upload"

if [ -f "$KEYSTORE" ]; then
  echo "An upload key already exists at $KEYSTORE — not overwriting it."
  exit 1
fi
command -v keytool >/dev/null 2>&1 || export PATH="/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home/bin:$PATH"

read -r -s -p "Choose a password for the upload key (8+ characters, no backslashes): " PASS; echo
read -r -s -p "Type it again: " PASS2; echo
[ "$PASS" = "$PASS2" ] || { echo "The two passwords don't match."; exit 1; }
[ ${#PASS} -ge 8 ] || { echo "Please use at least 8 characters."; exit 1; }
case "$PASS" in *\\*) echo "Please avoid backslashes."; exit 1;; esac

mkdir -p "$KEYDIR"; chmod 700 "$KEYDIR"
export SK_KEY_PASS="$PASS"
keytool -genkeypair -keystore "$KEYSTORE" -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass:env SK_KEY_PASS -keypass:env SK_KEY_PASS \
  -dname "CN=SafaKing, O=SafaKing Royal Turban House, L=Ahmedabad, ST=Gujarat, C=IN" >/dev/null
unset SK_KEY_PASS
chmod 600 "$KEYSTORE"

umask 077
cat > keystore.properties <<EOF
storeFile=$KEYSTORE
storePassword=$PASS
keyAlias=$ALIAS
keyPassword=$PASS
EOF

echo
echo "Upload key created: $KEYSTORE"
echo "BACK IT UP now, with its password (a password manager is ideal)."
echo "Every future update of the app must be signed with this same key."
echo
echo "Build the signed bundle for Play Console with:"
echo "  cd android && ./gradlew bundleRelease"
echo "It will be at android/app/build/outputs/bundle/release/app-release.aab"
