# PedrengoMeteo

Previsioni meteo per Pedrengo, in provincia di Bergamo, costruite incrociando i modelli
di tredici centri meteorologici nazionali invece di rivendere quello di un solo provider.

Il sito gira interamente nel browser: nessun server applicativo, nessuna chiave di accesso,
nessun intermediario fra le fonti e il calcolo.

## Cosa fa di diverso

La maggior parte dei servizi meteo dice "pioggia" e si ferma lì. Qui ogni numero mostrato
nasce da un confronto fra fonti, e porta con sé quanto ci si può fidare.

- **18 modelli fisici da 13 centri indipendenti**: ECMWF (IFS e la rete neurale AIFS),
  DWD tedesco (ICON globale, ICON-EU, ICON-D2 a 2 km), ARPAE ItaliaMeteo (ICON-2I a 2 km),
  NOAA (GFS), Météo-France (ARPEGE e AROME a 1,5 km), Met Office britannico, JMA giapponese,
  KNMI olandese, DMI danese, MET Norvegia, ECCC canadese, CMA cinese.
- **122 membri di ensemble** (ECMWF 51, ICON-EPS 40, GEFS 31) per calcolare probabilità
  vere invece di contare quanti modelli dicono pioggia.
- **Misure reali** dalle stazioni ARPA Lombardia più vicine, con un dato ogni dieci minuti.

## Come impara dai propri errori

A ogni apertura della pagina il sito recupera cosa aveva previsto ciascun modello 24, 48 e
72 ore prima, lo confronta con le misure delle stazioni, e da quel confronto ricava:

- il **peso di ogni centro** nel consenso, in modo che chi sbaglia poco conti di più;
- la **correzione dell'errore sistematico**, calcolata separatamente per notti serene,
  notti coperte, giornate soleggiate e coperte, perché l'errore dei modelli non è costante;
- la **taratura della probabilità di pioggia** sulla frequenza con cui è piovuto davvero
  quando i modelli erano d'accordo in una certa misura;
- l'**ancoraggio sull'ora corrente**, cioè di quanto ogni modello sta sbagliando adesso,
  applicato alle ore vicine con effetto decrescente.

Con la sezione "Onestà" il sito ricostruisce le previsioni dei giorni passati e le mette
accanto a quello che è successo, incluso il confronto con i singoli modelli.

## Struttura

| File | Contenuto |
| --- | --- |
| `pedrengometeo.html` | struttura della pagina e fogli di stile |
| `motore.js` | ingestione dati, verifica a posteriori, pesatura, fusione del consenso |
| `interfaccia.js` | grafici, bollettino, tabelle, avvio |
| `costruisci.sh` | unisce i tre file in `index.html` |
| `index.html` | il sito costruito, l'unico file che serve pubblicare |

Dopo aver modificato i sorgenti:

```sh
sh costruisci.sh
```

Per provarlo in locale su Windows basta il doppio clic su `Avvia PedrengoMeteo.bat`,
oppure da riga di comando:

```sh
python -m http.server 8791
```

Aprire il file `index.html` con un doppio clic può non bastare: alcuni browser bloccano
le richieste di rete dalle pagine aperte da disco. Serve un indirizzo http, anche locale.

## Limiti dichiarati

L'atmosfera è un sistema caotico e la previsione perfetta non esiste: due stati iniziali
indistinguibili divergono comunque, ed è un limite fisico, non un difetto di ingegneria.
Oltre le due settimane nessuna previsione batte la climatologia, e per i temporali estivi
il limite utile è molto più corto. Quello che si può fare, ed è quello che fa questo sito,
è togliere l'errore sistematico, misurare l'incertezza che resta e dichiararla.

## Fonti e licenze

- [Open-Meteo](https://open-meteo.com), che dà accesso ai modelli dei servizi
  meteorologici nazionali, licenza CC BY 4.0.
- [ARPA Lombardia](https://www.dati.lombardia.it), dati delle stazioni in open data.
