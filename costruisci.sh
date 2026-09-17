#!/bin/sh
# Unisce struttura, motore e interfaccia in un unico index.html autosufficiente.
# pedrengometeo.html contiene la testa (titolo, font, stile) fino a </style>
# e subito dopo il corpo, che parte da <div class="top">.
set -e
cd "$(dirname "$0")"
USCITA="${1:-index.html}"

{
  echo '<!doctype html>'
  echo '<html lang="it">'
  echo '<head>'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  echo '<meta name="description" content="Previsioni per Pedrengo costruite incrociando 18 modelli meteorologici di 13 centri nazionali, verificate ogni giorno contro i pluviometri ARPA Lombardia.">'
  echo '<meta name="theme-color" content="#EDF0F3" media="(prefers-color-scheme: light)">'
  echo '<meta name="theme-color" content="#0B131A" media="(prefers-color-scheme: dark)">'
  sed -n '1,/<\/style>/p' pedrengometeo.html
  echo '</head>'
  echo '<body>'
  sed -n '/<div class="top">/,$p' pedrengometeo.html
  echo '<script>'
  cat motore.js
  echo ''
  cat interfaccia.js
  echo '</script>'
  echo '</body>'
  echo '</html>'
} > "$USCITA"

echo "scritto $USCITA ($(wc -c < "$USCITA") byte)"
