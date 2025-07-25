#!/bin/bash

# Check if Polar is installed
if ! command -v polar &> /dev/null && ! ls /Applications | grep -iq polar; then
  echo "[ERROR] Polar is not installed."
  echo "\nInstallation instructions:"
  echo "1. Download Polar from: https://lightningpolar.com/download"
  echo "2. Open the .dmg file and drag Polar to your Applications folder."
  echo "3. Make sure Docker Desktop is installed and running."
  exit 1
else
  echo "[OK] Polar is installed."
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "[ERROR] Docker is not running. Please start Docker Desktop."
  exit 1
else
  echo "[OK] Docker is running."
fi

# Check if Polar Lightning Network containers are running
POLAR_CONTAINERS=$(docker ps --format '{{.Names}}' | grep -i 'polar-n')
if [ -z "$POLAR_CONTAINERS" ]; then
  echo "[ERROR] No Polar Lightning Network containers are running."
  echo "Start a network in the Polar app, then re-run this script."
  exit 1
else
  echo "[OK] Polar Lightning Network containers are running:"
  echo "$POLAR_CONTAINERS"
fi

# Try to make a test call to LND REST API (default ports: 8081, 8082, 8083)
LND_PORTS=(8081 8082 8083)
LND_WORKING=0
for PORT in "${LND_PORTS[@]}"; do
  RESPONSE=$(curl -sk https://localhost:$PORT/v1/getinfo)
  if [[ "$RESPONSE" == *'"code":2'* && "$RESPONSE" == *'macaroon'* ]]; then
    echo "[OK] LND REST API is responding on port $PORT (macaroon required)."
    LND_WORKING=1
    break
  fi
done

if [ $LND_WORKING -eq 1 ]; then
  echo "[SUCCESS] Lightning Network is working!"
else
  echo "[ERROR] Could not connect to LND REST API on default ports."
  echo "- Make sure your Polar network is running and has LND nodes."
  echo "- Check the Polar UI for node status."
  echo "- If you changed the default ports, update this script."
fi
