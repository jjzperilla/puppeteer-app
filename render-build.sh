#!/usr/bin/env bash
set -o errexit  # Exit on error

# Update package lists
apt-get update

# Install necessary packages
apt-get install -y wget unzip

# Download the latest stable version of Chromium
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb

# Install the downloaded package
dpkg -i google-chrome-stable_current_amd64.deb || apt-get -fy install

# Clean up
rm google-chrome-stable_current_amd64.deb

# Install Node.js dependencies
npm install
