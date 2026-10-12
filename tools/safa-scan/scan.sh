#!/bin/bash
# Photographs of a real safa → the .glb the virtual mirror wears.
#
#   tools/safa-scan/scan.sh ~/Desktop/jodhpuri-photos jodhpuri
#
# Writes public/models/<name>.glb. Everything happens on this Mac.
set -e

PHOTOS="$1"
NAME="$2"
DETAIL="${3:-reduced}"

if [ -z "$PHOTOS" ] || [ -z "$NAME" ]; then
  echo "usage: tools/safa-scan/scan.sh <folder-of-photos> <safa-name> [preview|reduced|medium|full]"
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BUILD="$ROOT/tools/safa-scan/build"
mkdir -p "$BUILD" "$ROOT/public/models"

if [ ! -x "$BUILD/safa-scan" ]; then
  echo "Building the scanner (once)…"
  swiftc -O -framework RealityKit -o "$BUILD/safa-scan" "$ROOT/tools/safa-scan/main.swift"
fi

echo "Reconstructing — this takes a while and the fan will run."
"$BUILD/safa-scan" "$PHOTOS" "$BUILD/$NAME.obj" "$DETAIL"

echo "Converting to .glb…"
npx --yes obj2gltf -i "$BUILD/$NAME.obj/baked_mesh.obj" -o "$ROOT/public/models/$NAME.glb" --unlit

echo
echo "Written: public/models/$NAME.glb"
echo "Point a safa at it in src/components/landing/SafaFittingStage.tsx and it is worn in the mirror."
