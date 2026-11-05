#!/bin/bash
# Double-cliquez sur ce fichier pour ouvrir la galerie sur votre Mac.
cd "$(dirname "$0")" || exit 1
PORT=8765
echo "Galerie : http://localhost:$PORT   ·   Administration : http://localhost:$PORT/admin/"
echo "Fermez cette fenêtre pour arrêter."
( sleep 1; open "http://localhost:$PORT/" ) &
exec python3 -m http.server "$PORT"
