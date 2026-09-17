/* ============================================================
   PedrengoMeteo - nowcasting per le prossime ore
   Sotto le tre ore i modelli fisici perdono contro l estrapolazione
   di quello che il radar sta gia vedendo. Qui si mettono insieme:
   il radar per sapere dove e la pioggia e dove sta andando,
   i modelli a 15 minuti per sapere quanta ne cade,
   i pluviometri per sapere cosa sta succedendo adesso sul paese.
   ============================================================ */

const RADAR = {
  indice: 'https://api.rainviewer.com/public/weather-maps.json',
  zoom: 7,
  frame: 6,          // ultima ora, cadenza dieci minuti
  lato: 512,         // due tessere per due tessere
  griglia: 128,      // maschera ridotta su cui si cerca il movimento
  ricerca: 20        // spostamento massimo cercato, in celle della griglia
};

function tesseraDi(lat, lon, z) {
  const n = Math.pow(2, z);
  const latRad = lat * Math.PI / 180;
  return {
    x: (lon + 180) / 360 * n,
    y: (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
  };
}

// metri per pixel alla latitudine del paese, con tessere da 256 pixel
function metriPerPixel(lat, z) {
  return 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z);
}

function caricaImmagine(url) {
  return new Promise((risolvi, rifiuta) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => risolvi(img);
    img.onerror = () => rifiuta(new Error('tessera non caricata'));
    img.src = url;
  });
}

/* Compone le quattro tessere di un frame in una sola tela e ne ricava una
   maschera ridotta: ogni cella vale 1 se in quel quadrato c e almeno un eco.
   Si usa il massimo e non la media per non perdere le celle temporalesche,
   che sono piccole e sarebbero cancellate da una media. */
async function maschera(host, percorso, tx0, ty0) {
  const tela = document.createElement('canvas');
  tela.width = RADAR.lato; tela.height = RADAR.lato;
  const ctx = tela.getContext('2d', { willReadFrequently: true });
  const pezzi = [];
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) {
    pezzi.push(caricaImmagine(`${host}${percorso}/256/${RADAR.zoom}/${tx0 + dx}/${ty0 + dy}/2/0_0.png`)
      .then(img => ctx.drawImage(img, dx * 256, dy * 256)));
  }
  await Promise.all(pezzi);
  const dati = ctx.getImageData(0, 0, RADAR.lato, RADAR.lato).data;
  const passo = RADAR.lato / RADAR.griglia;
  const m = new Uint8Array(RADAR.griglia * RADAR.griglia);
  let eco = 0;
  for (let gy = 0; gy < RADAR.griglia; gy++) {
    for (let gx = 0; gx < RADAR.griglia; gx++) {
      let massimo = 0;
      for (let y = 0; y < passo; y++) {
        for (let x = 0; x < passo; x++) {
          const p = (((gy * passo + y) * RADAR.lato) + (gx * passo + x)) * 4;
          if (dati[p + 3] > 40) massimo = 1;
        }
      }
      m[gy * RADAR.griglia + gx] = massimo;
      if (massimo) eco++;
    }
  }
  return { m, eco };
}

/* Spostamento che meglio sovrappone la prima maschera all ultima: e il metodo
   classico della persistenza lagrangiana, si assume che la pioggia continui a
   muoversi come si e mossa nell ultima ora.

   Due accortezze imparate guardando i dati veri. Primo, sulle Alpi quasi meta
   dell eco resta immobile in tutti i frame: e eco orografico e di terreno, non
   pioggia in movimento, e se lo si lascia dentro la correlazione si incolla sullo
   zero e dice sempre che il campo e fermo. Va escluso. Secondo, quando il picco
   di correlazione non e nettamente piu alto del resto, il movimento semplicemente
   non e determinabile: meglio dirlo che inventare una velocita e una direzione. */
function stimaMoto(prima, ultima, fisse) {
  const G = RADAR.griglia, R = RADAR.ricerca;
  let migliore = { dx: 0, dy: 0, punteggio: -1 };
  const tutti = [];
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      let comune = 0, totale = 0;
      for (let y = 0; y < G; y++) {
        const ys = y - dy;
        if (ys < 0 || ys >= G) continue;
        for (let x = 0; x < G; x++) {
          const xs = x - dx;
          if (xs < 0 || xs >= G) continue;
          if (fisse && (fisse[y * G + x] || fisse[ys * G + xs])) continue;
          const a = ultima.m[y * G + x], b = prima.m[ys * G + xs];
          if (a || b) totale++;
          if (a && b) comune++;
        }
      }
      if (totale < 20) continue;
      const punteggio = comune / totale;             // indice di sovrapposizione
      tutti.push(punteggio);
      if (punteggio > migliore.punteggio) migliore = { dx, dy, punteggio };
    }
  }
  if (!tutti.length) return null;
  tutti.sort((a, b) => a - b);
  const mediano = tutti[Math.floor(tutti.length / 2)];
  migliore.affidabile = migliore.punteggio >= 0.12 && migliore.punteggio >= 1.4 * mediano;
  migliore.mediano = mediano;
  return migliore;
}

const ROSA = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ovest', 'ovest', 'nord-ovest'];
function direzioneDa(dx, dy) {
  // dy cresce verso sud nelle tessere, quindi il segno va rovesciato
  const ang = Math.atan2(dx, -dy) * 180 / Math.PI;
  return ROSA[(Math.round(((ang + 360) % 360) / 45)) % 8];
}

async function leggiRadar() {
  const indice = await scarica(RADAR.indice, 15000);
  const passati = (indice.radar && indice.radar.past) || [];
  if (passati.length < 3) return null;
  const scelti = passati.slice(-RADAR.frame);
  const t = tesseraDi(SITO.lat, SITO.lon, RADAR.zoom);
  const tx0 = Math.floor(t.x - 0.5), ty0 = Math.floor(t.y - 0.5);
  const px = (t.x - tx0) * 256, py = (t.y - ty0) * 256;   // posizione di Pedrengo nella tela

  const maschere = [];
  for (const f of scelti) {
    try { maschere.push({ t: f.time, ...(await maschera(indice.host, f.path, tx0, ty0)) }); }
    catch (e) { /* un frame perso non ferma il resto */ }
  }
  if (maschere.length < 3) return null;

  const G = RADAR.griglia, scala = RADAR.lato / G;
  const gx = Math.floor(px / scala), gy = Math.floor(py / scala);
  const mpp = metriPerPixel(SITO.lat, RADAR.zoom) * scala;   // metri per cella
  const ultima = maschere[maschere.length - 1], prima = maschere[0];
  const minuti = (ultima.t - prima.t) / 60;

  // distanza e direzione dell eco piu vicino
  let vicino = null;
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    if (!ultima.m[y * G + x]) continue;
    const d = Math.hypot(x - gx, y - gy);
    if (!vicino || d < vicino.celle) vicino = { celle: d, x, y };
  }

  // eco presente in ogni scansione: quasi sempre montagna o terreno, non pioggia
  const fisse = new Uint8Array(G * G);
  let nFisse = 0;
  for (let i = 0; i < G * G; i++) {
    let sempre = true;
    for (const m of maschere) if (!m.m[i]) { sempre = false; break; }
    if (sempre) { fisse[i] = 1; nFisse++; }
  }

  const sopraIlPaese = ultima.m[gy * G + gx] === 1;
  let moto = null, arrivo = null;
  const s = (ultima.eco >= 12 && prima.eco >= 12 && minuti > 0) ? stimaMoto(prima, ultima, fisse) : null;
  if (s) {
    const kmh = Math.hypot(s.dx, s.dy) * mpp / 1000 / (minuti / 60);
    moto = {
      dx: s.dx, dy: s.dy, qualita: s.punteggio, kmh, affidabile: s.affidabile,
      da: direzioneDa(-s.dx, -s.dy), verso: direzioneDa(s.dx, s.dy)
    };
    // dove sara la pioggia che adesso e altrove: si guarda a ritroso lungo il moto
    if (!sopraIlPaese && s.affidabile && kmh > 3) {
      for (let min = 10; min <= 120; min += 10) {
        const f = min / minuti;
        const sx = Math.round(gx - s.dx * f), sy = Math.round(gy - s.dy * f);
        if (sx < 0 || sy < 0 || sx >= G || sy >= G) break;
        if (ultima.m[sy * G + sx]) { arrivo = min; break; }
      }
    }
  }

  return {
    ora: new Date(ultima.t * 1000),
    frame: maschere.length,
    sopraIlPaese,
    distanzaVicino: vicino ? vicino.celle * mpp / 1000 : null,
    direzioneVicino: (vicino && vicino.celle >= 1) ? direzioneDa(vicino.x - gx, vicino.y - gy) : null,
    copertura: ultima.eco / (G * G),
    quotaFissa: ultima.eco > 0 ? nFisse / ultima.eco : 0,
    moto, arrivo
  };
}

/* ---------------- modelli a quindici minuti ---------------- */

const MODELLI_FINI = [
  { id: 'icon_d2', nome: 'ICON-D2' },
  { id: 'italia_meteo_arpae_icon_2i', nome: 'ICON-2I' },
  { id: 'knmi_seamless', nome: 'HARMONIE' },
  { id: 'meteofrance_seamless', nome: 'AROME' },
  { id: 'dmi_seamless', nome: 'HARMONIE DK' },
  { id: 'icon_seamless', nome: 'ICON' }
];

async function leggiQuartiDora() {
  const r = await scarica(urlOpenMeteo('https://api.open-meteo.com/v1/forecast', {
    minutely_15: 'precipitation,precipitation_probability',
    models: MODELLI_FINI.map(m => m.id).join(','),
    forecast_days: 2
  }), 25000);
  const m = r && r.minutely_15;
  if (!m || !m.time) return null;
  const adesso = Date.now();
  const passi = [];
  for (let i = 0; i < m.time.length; i++) {
    const quando = dataDaChiave(m.time[i].slice(0, 13));
    const minuti = +m.time[i].slice(14, 16);
    const istante = new Date(quando.getTime() + minuti * 60000);
    if (istante < adesso - 15 * 60000 || istante > adesso + 3 * 3600e3) continue;
    const mm = [], prob = [];
    for (const mod of MODELLI_FINI) {
      const p = m['precipitation_' + mod.id];
      const q = m['precipitation_probability_' + mod.id];
      if (p && p[i] !== null && p[i] !== undefined) mm.push(p[i]);
      if (q && q[i] !== null && q[i] !== undefined) prob.push(q[i] / 100);
    }
    if (!mm.length) continue;
    passi.push({
      istante, etichetta: m.time[i].slice(11, 16),
      mm: media(mm), mmMax: Math.max(...mm),
      quanti: mm.filter(x => x >= 0.05).length, totale: mm.length,
      prob: prob.length ? media(prob) : null
    });
  }
  return passi;
}

/* ---------------- cosa dicono i pluviometri adesso ---------------- */

function tendenzaPluviometri(oss) {
  const adesso = chiaveOra(new Date());
  const ore = [0, -1, -2].map(d => chiaveDa(adesso, d));
  const valori = ore.map(k => oss.pioggia.has(k) ? oss.pioggia.get(k) : null);
  const ultima = valori[0], precedente = valori[1];
  let stato = 'asciutto';
  if (ultima !== null && ultima >= 0.2) stato = 'sta piovendo';
  else if (precedente !== null && precedente >= 0.2) stato = 'ha appena smesso';
  return {
    stato,
    oraCorrente: ultima, oraPrecedente: precedente,
    ultimeTreOre: somma(valori.filter(v => v !== null)),
    stazioni: oss.perStazione ? oss.perStazione[adesso] || oss.perStazione[chiaveDa(adesso, -1)] : null
  };
}

/* ---------------- verdetto ---------------- */

function costruisciNowcast(radar, quarti, pluvio) {
  const prossime = quarti ? quarti.filter(p => p.istante >= Date.now()) : [];
  const dueOre = prossime.filter(p => p.istante <= Date.now() + 2 * 3600e3);
  const mmDueOre = somma(dueOre.map(p => p.mm));
  const primoBagnato = prossime.find(p => p.mm >= 0.08 || (p.prob !== null && p.prob >= 0.5));

  let titolo, dettaglio, livello = 'asciutto';

  if (pluvio.stato === 'sta piovendo') {
    livello = 'piove';
    titolo = 'Sta piovendo adesso';
    dettaglio = `I pluviometri segnano ${g1(pluvio.oraCorrente)} mm in questa ora.`;
    if (radar && radar.moto && radar.moto.affidabile && radar.moto.kmh > 3) {
      dettaglio += ` Il radar vede la pioggia muoversi verso ${radar.moto.verso} a ${g0(radar.moto.kmh)} km/h.`;
    }
    if (mmDueOre < 0.15) dettaglio += ' I modelli ad alta risoluzione la danno in esaurimento entro un paio di ore.';
    else dettaglio += ` Attesi altri ${g1(mmDueOre)} mm nelle prossime due ore.`;
  } else if (radar && radar.sopraIlPaese) {
    livello = 'in arrivo';
    titolo = 'Il radar vede pioggia sul paese, i pluviometri no';
    dettaglio = 'Sono due cose diverse e possono convivere: il radar guarda le gocce in quota, il pluviometro quelle che toccano terra. Di solito vuol dire pioggia che evapora prima di arrivare, oppure che sta appena cominciando.';
    if (pluvio.oraPrecedente !== null && pluvio.oraPrecedente >= 0.2) dettaglio += ' Nell ora precedente qualcosa era caduto.';
    if (mmDueOre >= 0.15) dettaglio += ` I modelli a 15 minuti danno ${g1(mmDueOre)} mm nelle prossime due ore.`;
  } else if (radar && radar.arrivo !== null) {
    livello = 'in arrivo';
    titolo = `Pioggia in arrivo fra circa ${radar.arrivo} minuti`;
    dettaglio = `Il radar vede eco a ${g0(radar.distanzaVicino)} km a ${radar.direzioneVicino}, in movimento verso ${radar.moto.verso} a ${g0(radar.moto.kmh)} km/h.`;
    if (primoBagnato) dettaglio += ` I modelli a 15 minuti la danno dalle ${primoBagnato.etichetta}.`;
  } else if (primoBagnato) {
    livello = 'in arrivo';
    titolo = `Pioggia prevista dalle ${primoBagnato.etichetta}`;
    dettaglio = `${primoBagnato.quanti} modelli ad alta risoluzione su ${primoBagnato.totale} la vedono, per ${g1(mmDueOre)} mm nelle due ore.`;
    if (radar && !radar.sopraIlPaese && radar.distanzaVicino !== null) {
      dettaglio += ` Il radar per ora non vede niente entro ${g0(radar.distanzaVicino)} km.`;
    }
  } else {
    titolo = 'Asciutto nelle prossime ore';
    if (radar && radar.distanzaVicino !== null && radar.distanzaVicino < 150) {
      dettaglio = `Il radar vede pioggia a ${g0(radar.distanzaVicino)} km${radar.direzioneVicino ? ' a ' + radar.direzioneVicino : ''}`;
      dettaglio += (radar.moto && radar.moto.affidabile && radar.moto.kmh > 3)
        ? `, ma si muove verso ${radar.moto.verso} e non punta sul paese.`
        : ((radar.moto && radar.moto.affidabile) ? ', e il campo di pioggia è quasi fermo.' : ', ma il suo movimento non è abbastanza netto per dire dove andrà.');
    } else if (radar) {
      dettaglio = 'Il radar non vede pioggia in avvicinamento, e nessun modello ad alta risoluzione ne prevede.';
    } else {
      dettaglio = 'Nessun modello ad alta risoluzione prevede pioggia nelle prossime tre ore.';
    }
  }
  return { livello, titolo, dettaglio, mmDueOre, prossime, radar, pluvio };
}
