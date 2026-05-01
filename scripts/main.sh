#!/bin/bash
set -e

apt-get update
apt-get install -y --no-install-recommends python3

cd /www
exec python3 -m http.server 8080
