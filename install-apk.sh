#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <apk-file>"
  exit 1
fi

APK_FILE="$1"

export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
export PATH="$ANDROID_SDK_ROOT/platform-tools:$PATH"

adb start-server

# Get all connected device IDs
DEVICE_IDS=($(adb devices | awk 'NR>1 && $1!="" {print $1}'))

if [ ${#DEVICE_IDS[@]} -eq 0 ]; then
  echo "No devices found."
  exit 1
fi

echo "Connected devices:"
for i in "${!DEVICE_IDS[@]}"; do
  echo "$((i+1)). ${DEVICE_IDS[$i]}"
done

read -p "Enter the number of the device to install the APK on: " CHOICE

if ! [[ "$CHOICE" =~ ^[0-9]+$ ]] || [ "$CHOICE" -lt 1 ] || [ "$CHOICE" -gt "${#DEVICE_IDS[@]}" ]; then
  echo "Invalid selection."
  exit 1
fi

SELECTED_DEVICE="${DEVICE_IDS[$((CHOICE-1))]}"
echo "Installing $APK_FILE on device $SELECTED_DEVICE..."
adb -s "$SELECTED_DEVICE" install "$APK_FILE"

# Start the app after install
PACKAGE_NAME="com.crbee.mooncalendar" # <-- Change if your package name is different
echo "Launching app $PACKAGE_NAME on device $SELECTED_DEVICE..."
adb -s "$SELECTED_DEVICE" shell monkey -p "$PACKAGE_NAME" -c android.intent.category.LAUNCHER 1