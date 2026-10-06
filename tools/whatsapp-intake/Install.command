#!/bin/zsh
set -e
cd "${0:A:h}"
if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then
  print 'Install Node.js LTS from https://nodejs.org/ and run this installer again.'
  open 'https://nodejs.org/en/download'
  read '?Press Enter to close...'
  exit 1
fi
node src/macos.mjs
read '?Press Enter to close...'
