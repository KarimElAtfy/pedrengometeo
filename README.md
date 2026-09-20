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

A ogni apertura la pagina recupera cosa aveva previsto ciascun modello 24, 48 e 72 ore
prima, lo confronta con le misure delle stazioni, e da quel confronto ricava:

- la **correzione dell'errore sistematico**, calcolata separatamente per notti serene,
  notti coperte, giornate soleggiate e coperte, perché l'errore dei modelli non è costante;
- la **correzione dedicata alla massima del giorno**, che è un caso a parte: il massimo di
  una media è sempre più basso della media dei massimi, e su questo i modelli sbagliavano
  di un grado e mezzo in difetto;
- l'**allargamento della fascia di incertezza** fino a quando la copertura dichiarata
  corrisponde a quella reale, misurata;
- la **taratura della probabilità di pioggia** sulla frequenza con cui è piovuto davvero;
- lo **sfasamento temporale** della pioggia di ogni modello, corretto quando è costante;
- l'**ancoraggio sull'ora corrente**, cioè di quanto ogni modello sta sbagliando adesso.

Ogni correzione viene accettata solo dopo una prova fuori campione: si allena su un periodo
e si misura su giorni mai visti. Una che non sopravvive a quella prova sta imparando a
memoria il passato, non a prevedere il futuro.

### Una che è stata buttata via

Pesare di più i modelli più bravi sembrava ovvio. Messa alla prova su ventuno giorni mai
visti peggiorava il risultato a ogni dose, da 0,968 gradi con tutti i centri uguali a 0,985
con la pesatura piena. È stata tolta. La pagella dei modelli resta nel sito, ma come
informazione da leggere, non come peso nel calcolo.

## Nowcasting

Sotto le tre ore i modelli fisici sono al loro punto più debole. Il sito usa allora l'eco
radar di RainViewer: legge i pixel delle ultime sei scansioni, scarta l'eco che resta
immobile in tutte (sulle Alpi è quasi metà del totale, ed è terreno, non pioggia), stima lo
spostamento del campo per correlazione e lo estrapola in avanti. Se il picco di correlazione
non è netto, dichiara che il movimento non è determinabile invece di inventare una
direzione. Accanto ci sono sei modelli a 2 km che aggiornano ogni quarto d'ora e i
pluviometri del paese.

## L'archivio

`.github/workflows/archivio.yml` esegue ogni notte `strumenti/archivia.js`, che fa le due
cose che il browser non può fare a ogni apertura:

1. guarda indietro **novantadue giorni** invece di ventuno. Per la temperatura non cambia
   niente, ed è stato verificato; per la pioggia cambia tutto, perché in tre settimane ci
   sono sei o sette ore piovose e in tre mesi circa ottanta;
2. mette da parte in `dati/emesse/` la previsione che il sito ha **davvero emesso** quel
   giorno, e la verifica quando il giorno si chiude. È un registro che non può essere
   riscritto col senno di poi, a differenza di qualsiasi ricostruzione.

I risultati finiscono in `dati/`, che la pagina carica all'apertura. Se il lavoro notturno
non gira, il sito continua a funzionare con la sua finestra corta.

## Struttura

| File | Contenuto |
| --- | --- |
| `pedrengometeo.html` | struttura della pagina e fogli di stile |
| `motore.js` | ingestione dati, verifica a posteriori, correzioni, fusione del consenso |
| `nowcast.js` | radar, modelli a 15 minuti, verdetto sulle prossime ore |
| `interfaccia.js` | grafici, bollettino, tabelle, avvio |
| `costruisci.sh` | unisce i quattro file in `index.html` |
| `index.html` | il sito costruito, l'unico file che serve pubblicare |
| `prova.js` | banco di prova: scarica i dati veri e stampa cosa calcola il motore |
| `strumenti/archivia.js` | il lavoro notturno che riempie `dati/` |
| `dati/` | tarature lunghe, previsioni emesse, registro delle verifiche |

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
