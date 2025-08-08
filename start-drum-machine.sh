#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Drum Machine..."
echo "Opening http://localhost:3000 in your browser..."
open http://localhost:3000
npx serve dist
