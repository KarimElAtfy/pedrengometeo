/* ============================================================
   PedrengoMeteo - motore
   Ingestione multimodello, verifica a posteriori sulle misure
   ARPA, pesatura per bravura e fusione del consenso.
   ============================================================ */

const SITO = { lat: 45.694, lon: 9.734, quota: 262, nome: 'Pedrengo' };

const MODELLI = [
  { id: 'ecmwf_ifs025',              nome: 'IFS',          ente: 'ECMWF',              fam: 'ecmwf',  ris: '25 km' },
  { id: 'ecmwf_aifs025_single',      nome: 'AIFS',         ente: 'ECMWF, rete neurale', fam: 'aifs',  ris: '25 km' },
  { id: 'icon_seamless',             nome: 'ICON',         ente: 'DWD Germania',       fam: 'icon',   ris: '2-13 km' },
  { id: 'icon_eu',                   nome: 'ICON-EU',      ente: 'DWD Germania',       fam: 'icon',   ris: '7 km' },
  { id: 'icon_d2',                   nome: 'ICON-D2',      ente: 'DWD Germania',       fam: 'icon',   ris: '2 km' },
  { id: 'italia_meteo_arpae_icon_2i',nome: 'ICON-2I',      ente: 'ItaliaMeteo ARPAE',  fam: 'icon2i', ris: '2 km' },
  { id: 'gfs_seamless',              nome: 'GFS',          ente: 'NOAA Stati Uniti',   fam: 'gfs',    ris: '11-25 km' },
  { id: 'gfs_global',                nome: 'GFS globale',  ente: 'NOAA Stati Uniti',   fam: 'gfs',    ris: '25 km' },
  { id: 'meteofrance_seamless',      nome: 'AROME-ARPEGE', ente: 'Meteo-France',       fam: 'mf',     ris: '1.5-11 km' },
  { id: 'arpege_europe',             nome: 'ARPEGE',       ente: 'Meteo-France',       fam: 'mf',     ris: '11 km' },
  { id: 'arome_france_hd',           nome: 'AROME HD',     ente: 'Meteo-France',       fam: 'mf',     ris: '1.5 km' },
  { id: 'ukmo_seamless',             nome: 'UM',           ente: 'Met Office UK',      fam: 'ukmo',   ris: '2-10 km' },
  { id: 'jma_seamless',              nome: 'GSM',          ente: 'JMA Giappone',       fam: 'jma',    ris: '55 km' },
  { id: 'knmi_seamless',             nome: 'HARMONIE',     ente: 'KNMI Paesi Bassi',   fam: 'knmi',   ris: '2-5.5 km' },
  { id: 'dmi_seamless',              nome: 'HARMONIE DK',  ente: 'DMI Danimarca',      fam: 'dmi',    ris: '2 km' },
  { id: 'metno_seamless',            nome: 'MEPS',         ente: 'MET Norvegia',       fam: 'metno',  ris: '1-2.5 km' },
  { id: 'gem_seamless',              nome: 'GEM',          ente: 'ECCC Canada',        fam: 'gem',    ris: '2.5-15 km' },
  { id: 'cma_grapes_global',         nome: 'GRAPES',       ente: 'CMA Cina',           fam: 'cma',    ris: '15 km' }
];
const PER_ID = Object.fromEntries(MODELLI.map(m => [m.id, m]));
const FAMIGLIE = [...new Set(MODELLI.map(m => m.fam))];

const STAZIONI = [
  { id: '8145',  tipo: 'temp',    nome: 'Torre Boldone',      km: 3.3, quota: 311 },
  { id: '19022', tipo: 'temp',    nome: 'Bergamo via Maffei', km: 4.6, quota: 249 },
  { id: '5864',  tipo: 'temp',    nome: 'Bergamo via Goisis', km: 4.2, quota: 290 },
  { id: '8161',  tipo: 'pioggia', nome: 'Torre Boldone',      km: 3.3, quota: 311 },
  { id: '19026', tipo: 'pioggia', nome: 'Bergamo via Maffei', km: 4.6, quota: 249 },
  { id: '5857',  tipo: 'pioggia', nome: 'Bergamo via Goisis', km: 4.2, quota: 290 },
  { id: '22322', tipo: 'pioggia', nome: 'Trescore Balneario', km: 8.7, quota: 251 },
  { id: '6158',  tipo: 'umidita', nome: 'Bergamo via Goisis', km: 4.2, quota: 290 },
  { id: '19103', tipo: 'vento',   nome: 'Bergamo via Goisis', km: 4.2, quota: 290 },
  { id: '5981',  tipo: 'dirvento',nome: 'Bergamo via Goisis', km: 4.2, quota: 290 }
];

const VARIABILI = ['temperature_2m', 'precipitation', 'precipitation_probability', 'weather_code',
                   'cloud_cover', 'wind_speed_10m', 'wind_gusts_10m', 'relative_humidity_2m', 'snowfall'];

const SOGLIA_PIOGGIA = 0.2;   // mm/h oltre cui si considera che stia piovendo
const GIORNI_VERIFICA = 10;   // finestra di misure ARPA scaricata

/* ---------------- utilità di base ---------------- */

const fmtSE = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false
});

function chiaveOra(d) { return fmtSE.format(d).replace(' ', 'T').slice(0, 13); }
function chiaveDa(k, dOre) { return chiaveOra(new Date(dataDaChiave(k).getTime() + dOre * 3600e3)); }

// una chiave locale "2026-09-17T14" torna a essere un istante reale,
// anche a cavallo del cambio dell'ora legale
function dataDaChiave(k) {
  const bersaglio = Date.parse(k + ':00:00Z');
  let t = bersaglio;
  for (let i = 0; i < 4; i++) {
    const ottenuta = chiaveOra(new Date(t));
    if (ottenuta === k) break;
    t += bersaglio - Date.parse(ottenuta + ':00:00Z');
  }
  return new Date(t);
}

const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
const media = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const somma = a => a.reduce((s, x) => s + x, 0);
const chiudi = (v, a, b) => Math.max(a, Math.min(b, v));

function mediaPesata(coppie) {           // [[valore, peso]]
  let sv = 0, sp = 0;
  for (const [v, p] of coppie) { if (v === null || !isFinite(v)) continue; sv += v * p; sp += p; }
  return sp > 0 ? sv / sp : null;
}

function quantilePesato(coppie, q) {
  const v = coppie.filter(c => c[0] !== null && isFinite(c[0])).sort((a, b) => a[0] - b[0]);
  if (!v.length) return null;
  const tot = somma(v.map(c => c[1]));
  if (tot <= 0) return null;
  let acc = 0;
  for (let i = 0; i < v.length; i++) {
    const prima = acc / tot, dopo = (acc + v[i][1]) / tot;
    if (q <= dopo) {
      if (i === 0 || q <= prima) return v[i][0];
      const t = (q - prima) / Math.max(1e-9, dopo - prima);
      return v[i - 1][0] + (v[i][0] - v[i - 1][0]) * Math.min(1, t);
    }
    acc += v[i][1];
  }
  return v[v.length - 1][0];
}

const medianaPesata = c => quantilePesato(c, 0.5);

/* ---------------- rete ---------------- */

async function scarica(url, ms = 30000) {
  const ctrl = new AbortController();
  const stop = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(stop); }
}

async function scaricaConRitento(url, ms) {
  try { return await scarica(url, ms); }
  catch (e) { await new Promise(r => setTimeout(r, 900)); return await scarica(url, ms); }
}

function urlOpenMeteo(base, extra) {
  const p = new URLSearchParams({
    latitude: SITO.lat, longitude: SITO.lon, elevation: SITO.quota,
    timezone: 'Europe/Rome', ...extra
  });
  return base + '?' + p.toString();
}

const URL_ARPA = 'https://www.dati.lombardia.it/resource/647i-nhxk.json';

function urlArpa(ids, daISO, limite) {
  const inClause = ids.map(i => "'" + i + "'").join(',');
  const p = new URLSearchParams({
    '$select': 'idsensore,data,valore',
    '$where': `idsensore in(${inClause}) AND data > '${daISO}'`,
    '$order': 'data DESC',
    '$limit': String(limite)
  });
  return URL_ARPA + '?' + p.toString();
}

/* ---------------- lettura Open-Meteo multimodello ---------------- */

function leggiMultiModello(risposta, listaId, variabili) {
  const h = risposta && risposta.hourly;
  const fuori = { ore: [], serie: {} };
  if (!h || !h.time) return fuori;
  fuori.ore = h.time.map(t => t.slice(0, 13));
  for (const id of listaId) {
    const s = {};
    let almenoUno = false;
    for (const v of variabili) {
      const col = h[v + '_' + id];
      if (!col) continue;
      const m = new Map();
      for (let i = 0; i < fuori.ore.length; i++) {
        const x = num(col[i]);
        if (x !== null) { m.set(fuori.ore[i], x); almenoUno = true; }
      }
      s[v] = m;
    }
    if (almenoUno) fuori.serie[id] = s;
  }
  return fuori;
}

function leggiEnsemble(risposta) {
  const h = risposta && risposta.hourly;
  const sistemi = {};
  if (!h || !h.time) return { ore: [], sistemi };
  const ore = h.time.map(t => t.slice(0, 13));
  for (const chiave of Object.keys(h)) {
    if (chiave === 'time') continue;
    // le colonne arrivano come temperature_2m_member07_icon_eu_eps, con il membro in mezzo
    const m = chiave.match(/^(temperature_2m|precipitation)_(?:member(\d+)_)?(.+)$/);
    if (!m) continue;
    const variabile = m[1], membro = m[2] ? +m[2] : 0, sistema = m[3];
    sistemi[sistema] = sistemi[sistema] || { nome: sistema, membri: new Map() };
    const mm = sistemi[sistema].membri;
    if (!mm.has(membro)) mm.set(membro, { temperature_2m: new Map(), precipitation: new Map() });
    const dest = mm.get(membro)[variabile];
    const col = h[chiave];
    for (let i = 0; i < ore.length; i++) { const x = num(col[i]); if (x !== null) dest.set(ore[i], x); }
  }
  return { ore, sistemi };
}

/* ---------------- osservazioni ARPA ---------------- */

function aggregaArpa(righe) {
  const per = {};                                  // idsensore -> Map(chiaveOra -> [valori])
  for (const r of righe) {
    const v = parseFloat(r.valore);
    if (!isFinite(v) || v <= -900) continue;
    if (r.stato && r.stato !== 'VA') continue;
    const k = chiaveOra(new Date(r.data.length > 19 ? r.data + 'Z' : r.data + '.000Z'));
    per[r.idsensore] = per[r.idsensore] || new Map();
    const m = per[r.idsensore];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(v);
  }
  return per;
}

function serieOsservate(per) {
  const out = { temp: new Map(), pioggia: new Map(), umidita: new Map(), vento: new Map(), perStazione: {} };
  const tempSt = STAZIONI.filter(s => s.tipo === 'temp');
  const pioSt  = STAZIONI.filter(s => s.tipo === 'pioggia');

  // temperatura: media pesata per vicinanza, riportata a 262 m con gradiente 6.5 gradi al km
  const chiaviT = new Set();
  tempSt.forEach(s => (per[s.id] || new Map()).forEach((_, k) => chiaviT.add(k)));
  for (const k of chiaviT) {
    const coppie = [];
    for (const s of tempSt) {
      const vals = (per[s.id] || new Map()).get(k);
      if (!vals || !vals.length) continue;
      const t = media(vals) + (s.quota - SITO.quota) * 0.0065;
      coppie.push([t, 1 / Math.pow(s.km, 1.4)]);
    }
    const v = mediaPesata(coppie);
    if (v !== null) out.temp.set(k, v);
  }

  // pioggia: media pesata dei pluviometri, e scarto fra pluviometri come misura di quanto è disomogenea
  const chiaviP = new Set();
  pioSt.forEach(s => (per[s.id] || new Map()).forEach((_, k) => chiaviP.add(k)));
  for (const k of chiaviP) {
    const coppie = [], grezzi = [];
    for (const s of pioSt) {
      const vals = (per[s.id] || new Map()).get(k);
      if (!vals || !vals.length) continue;
      const mm = somma(vals);
      grezzi.push({ nome: s.nome, mm });
      coppie.push([mm, 1 / Math.pow(s.km, 1.4)]);
    }
    const v = mediaPesata(coppie);
    if (v !== null) { out.pioggia.set(k, v); out.perStazione[k] = grezzi; }
  }

  for (const [tipo, chiave] of [['umidita', 'umidita'], ['vento', 'vento']]) {
    const st = STAZIONI.filter(s => s.tipo === tipo);
    for (const s of st) {
      (per[s.id] || new Map()).forEach((vals, k) => { if (!out[chiave].has(k)) out[chiave].set(k, media(vals)); });
    }
  }
  return out;
}

/* verifica che i timbri ARPA e quelli dei modelli siano allineati:
   cerca lo sfasamento che minimizza lo scarto, entro un'ora */
function controllaAllineamento(oss, analisi) {
  const prova = s => {
    const d = [];
    oss.forEach((v, k) => {
      const a = analisi.get(chiaveDa(k, s));
      if (a !== undefined) d.push(Math.abs(v - a));
    });
    return d.length >= 24 ? { s, mae: media(d), n: d.length } : null;
  };
  const esiti = [-1, 0, 1].map(prova).filter(Boolean);
  if (esiti.length < 2) return { scarto: 0, sicuro: false };
  esiti.sort((a, b) => a.mae - b.mae);
  const zero = esiti.find(e => e.s === 0);
  if (esiti[0].s !== 0 && zero && (zero.mae - esiti[0].mae) > 0.25) {
    return { scarto: esiti[0].s, sicuro: true, mae: esiti[0].mae };
  }
  return { scarto: 0, sicuro: true, mae: zero ? zero.mae : esiti[0].mae };
}

function spostaSerie(m, ore) {
  if (!ore) return m;
  const n = new Map();
  m.forEach((v, k) => n.set(chiaveDa(k, ore), v));
  return n;
}

/* ---------------- regimi e correzioni ---------------- */

function regimeDi(k, nuvole) {
  const ora = +k.slice(11, 13);
  const notte = (ora >= 21 || ora < 7);
  const coperto = (nuvole === null || nuvole === undefined) ? true : nuvole >= 55;
  return (notte ? 'notte' : 'giorno') + '-' + (coperto ? 'coperto' : 'sereno');
}

function smorza(valore, n, globale, k = 24) {
  if (n <= 0) return globale;
  return (n * valore + k * globale) / (n + k);
}

/* ---------------- pagella dei modelli ---------------- */
/* Per ogni modello si recupera cosa aveva previsto 24, 48 e 72 ore prima
   e lo si confronta con le misure corrette al punto di Pedrengo.        */

function calcolaPagella(precedenti, oss, nuvoleRif) {
  const esito = {};
  const leads = [24, 48, 72];

  for (const m of MODELLI) {
    const s = precedenti.serie[m.id];
    if (!s) continue;
    const voce = { id: m.id, per: {}, regimi: {}, campioni: 0 };

    for (const lead of leads) {
      const suff = lead === 24 ? '_previous_day1' : lead === 48 ? '_previous_day2' : '_previous_day3';
      const serieT = s['temperature_2m' + suff];
      const serieP = s['precipitation' + suff];
      if (!serieT && !serieP) continue;

      const dT = [], scarti = [];
      const perRegime = {};
      let colpiti = 0, mancati = 0, falsi = 0, corretti = 0, totP = 0;
      const dP = [];

      if (serieT) {
        serieT.forEach((prev, k) => {
          const vero = oss.temp.get(k);
          if (vero === undefined) return;
          const e = prev - vero;
          dT.push(Math.abs(e)); scarti.push(e);
          const reg = regimeDi(k, nuvoleRif.get(k));
          (perRegime[reg] = perRegime[reg] || []).push(e);
        });
      }
      if (serieP) {
        serieP.forEach((prev, k) => {
          const vero = oss.pioggia.get(k);
          if (vero === undefined) return;
          totP++;
          dP.push(Math.abs(prev - vero));
          const pPrev = prev >= 0.1, pVero = vero >= SOGLIA_PIOGGIA;
          if (pPrev && pVero) colpiti++;
          else if (!pPrev && pVero) mancati++;
          else if (pPrev && !pVero) falsi++;
          else corretti++;
        });
      }

      if (dT.length >= 12 || totP >= 12) {
        voce.per[lead] = {
          mae: dT.length ? media(dT) : null,
          scarto: scarti.length ? media(scarti) : null,
          n: dT.length,
          maeMm: dP.length ? media(dP) : null,
          pod: (colpiti + mancati) > 0 ? colpiti / (colpiti + mancati) : null,
          far: (colpiti + falsi) > 0 ? falsi / (colpiti + falsi) : null,
          esatte: totP > 0 ? (colpiti + corretti) / totP : null,
          nP: totP
        };
        voce.campioni += dT.length;
        if (lead === 24) {
          for (const r of Object.keys(perRegime)) {
            voce.regimi[r] = { scarto: media(perRegime[r]), n: perRegime[r].length };
          }
        }
      }
    }
    if (Object.keys(voce.per).length) esito[m.id] = voce;
  }
  return esito;
}

function maeInterpolato(voce, lead) {
  if (!voce) return null;
  const punti = [[24, voce.per[24]], [48, voce.per[48]], [72, voce.per[72]]]
    .filter(p => p[1] && p[1].mae !== null);
  if (!punti.length) return null;
  if (lead <= punti[0][0]) return punti[0][1].mae * (lead < 24 ? 0.72 + 0.28 * (lead / 24) : 1);
  for (let i = 0; i < punti.length - 1; i++) {
    if (lead <= punti[i + 1][0]) {
      const t = (lead - punti[i][0]) / (punti[i + 1][0] - punti[i][0]);
      return punti[i][1].mae + (punti[i + 1][1].mae - punti[i][1].mae) * t;
    }
  }
  const ult = punti[punti.length - 1];
  return ult[1].mae * (1 + 0.16 * (lead - ult[0]) / 24);
}

/* peso di ogni famiglia per un certo anticipo: chi sbaglia poco pesa di più */
function pesiFamiglia(pagella, lead, disponibili) {
  const perFam = {};
  for (const id of disponibili) {
    const m = PER_ID[id]; if (!m) continue;
    const mae = maeInterpolato(pagella[id], lead);
    (perFam[m.fam] = perFam[m.fam] || []).push({ id, mae });
  }
  const grezzi = {};
  const noti = Object.values(perFam).flat().map(x => x.mae).filter(x => x !== null);
  const riferimento = noti.length ? media(noti) : 1.6;
  for (const f of Object.keys(perFam)) {
    const maes = perFam[f].map(x => x.mae === null ? riferimento : x.mae);
    const mm = media(maes);
    grezzi[f] = 1 / Math.pow(Math.max(0.35, mm) + 0.45, 2);
  }
  let tot = somma(Object.values(grezzi));
  let pesi = {};
  for (const f of Object.keys(grezzi)) pesi[f] = grezzi[f] / tot;
  // nessuna famiglia può dominare né sparire del tutto
  const nf = Object.keys(pesi).length;
  const tetto = Math.max(0.22, 1.8 / nf), pavimento = 0.25 / nf;
  for (const f of Object.keys(pesi)) pesi[f] = chiudi(pesi[f], pavimento, tetto);
  tot = somma(Object.values(pesi));
  for (const f of Object.keys(pesi)) pesi[f] /= tot;
  return { pesi, membri: perFam, riferimento };
}

/* ---------------- curva di affidabilità della pioggia ---------------- */
/* Quante volte, quando N modelli su M dicevano pioggia, è piovuto davvero. */

function curvaAffidabilita(precedenti, oss) {
  const bins = Array.from({ length: 11 }, (_, i) => ({ c: i / 10, n: 0, colpi: 0 }));
  const chiavi = new Set();
  for (const m of MODELLI) {
    const s = precedenti.serie[m.id]; if (!s) continue;
    const p = s['precipitation_previous_day1']; if (!p) continue;
    p.forEach((_, k) => chiavi.add(k));
  }
  for (const k of chiavi) {
    const vero = oss.pioggia.get(k);
    if (vero === undefined) continue;
    const perFam = {};
    for (const m of MODELLI) {
      const s = precedenti.serie[m.id]; if (!s) continue;
      const p = s['precipitation_previous_day1']; if (!p || !p.has(k)) continue;
      (perFam[m.fam] = perFam[m.fam] || []).push(p.get(k));
    }
    const fams = Object.keys(perFam);
    if (fams.length < 6) continue;
    const bagnate = fams.filter(f => media(perFam[f]) >= 0.1).length;
    const frazione = bagnate / fams.length;
    const b = bins[Math.round(frazione * 10)];
    b.n++; if (vero >= SOGLIA_PIOGGIA) b.colpi++;
  }
  return bins;
}

function applicaCurva(frazione, bins, forza = 8) {
  if (!bins || !bins.length) return frazione;
  const i = chiudi(Math.round(frazione * 10), 0, 10);
  const b = bins[i];
  const osservata = b.n > 0 ? b.colpi / b.n : frazione;
  return chiudi(smorza(osservata, b.n, frazione, forza), 0, 1);
}

/* ---------------- consenso ---------------- */

function costruisciConsenso(ctx) {
  const { det, ens, pagella, oss, bins, adesso } = ctx;
  const ore = det.ore.filter(k => k >= adesso);
  const consenso = [];

  // nuvolosità grezza, serve per decidere il regime prima di correggere
  const nuvoleGrezze = new Map();
  for (const k of det.ore) {
    const v = [];
    for (const id of Object.keys(det.serie)) {
      const c = det.serie[id].cloud_cover; if (c && c.has(k)) v.push(c.get(k));
    }
    if (v.length) nuvoleGrezze.set(k, media(v));
  }

  // ancoraggio sull'adesso: quanto ogni modello sta sbagliando proprio ora
  const ancore = {};
  for (const id of Object.keys(det.serie)) {
    const t = det.serie[id].temperature_2m; if (!t) continue;
    const diff = [];
    for (let i = 1; i <= 4; i++) {
      const k = chiaveDa(adesso, -i);
      const vero = oss.temp.get(k), prev = t.get(k);
      if (vero !== undefined && prev !== undefined) diff.push(prev - vero);
    }
    if (diff.length >= 2) ancore[id] = media(diff);
  }

  for (const k of ore) {
    const lead = Math.max(0, Math.round((dataDaChiave(k) - dataDaChiave(adesso)) / 3600e3));
    const disponibili = Object.keys(det.serie).filter(id => det.serie[id].temperature_2m && det.serie[id].temperature_2m.has(k));
    if (!disponibili.length) continue;
    const { pesi, membri } = pesiFamiglia(pagella, lead, disponibili);
    const reg = regimeDi(k, nuvoleGrezze.get(k));

    // valore di famiglia, corretto per errore sistematico e per l'ancoraggio
    const valoriFam = {}, pioggiaFam = {}, nuvoleFam = {}, ventoFam = {}, raficheFam = {}, umiditaFam = {}, neveFam = {}, probFam = {};
    const dettaglio = [];
    for (const f of Object.keys(membri)) {
      const tt = [], pp = [], nn = [], vv = [], rr = [], uu = [], ss = [], qq = [];
      for (const { id } of membri[f]) {
        const s = det.serie[id]; if (!s) continue;
        const grezza = s.temperature_2m && s.temperature_2m.has(k) ? s.temperature_2m.get(k) : null;
        if (grezza !== null) {
          const voce = pagella[id];
          let corr = 0;
          if (voce) {
            const glob = voce.per[24] ? (voce.per[24].scarto || 0) : 0;
            const r = voce.regimi[reg];
            corr = r ? smorza(r.scarto, r.n, glob) : glob;
            corr *= chiudi(0.35 + 0.65 * Math.min(1, lead / 30), 0.35, 1);
          }
          let ancora = 0;
          if (ancore[id] !== undefined) {
            const residuo = ancore[id] - corr;
            ancora = residuo * Math.exp(-lead / 9);
          }
          const val = grezza - corr - ancora;
          tt.push(val);
          dettaglio.push({ id, fam: f, t: val, tGrezza: grezza, corr: corr + ancora });
        }
        const g = (v) => s[v] && s[v].has(k) ? s[v].get(k) : null;
        const p = g('precipitation'); if (p !== null) pp.push(p);
        const n = g('cloud_cover'); if (n !== null) nn.push(n);
        const w = g('wind_speed_10m'); if (w !== null) vv.push(w);
        const ra = g('wind_gusts_10m'); if (ra !== null) rr.push(ra);
        const um = g('relative_humidity_2m'); if (um !== null) uu.push(um);
        const ne = g('snowfall'); if (ne !== null) ss.push(ne);
        const pr = g('precipitation_probability'); if (pr !== null) qq.push(pr);
      }
      if (tt.length) valoriFam[f] = media(tt);
      if (pp.length) pioggiaFam[f] = media(pp);
      if (nn.length) nuvoleFam[f] = media(nn);
      if (vv.length) ventoFam[f] = media(vv);
      if (rr.length) raficheFam[f] = media(rr);
      if (uu.length) umiditaFam[f] = media(uu);
      if (ss.length) neveFam[f] = media(ss);
      if (qq.length) probFam[f] = media(qq) / 100;
    }

    const coppieT = Object.keys(valoriFam).map(f => [valoriFam[f], pesi[f] || 0]);
    const t = medianaPesata(coppieT);
    if (t === null) continue;

    // incertezza: dispersione fra famiglie, allargata dalla dispersione dell'ensemble
    let p10 = quantilePesato(coppieT, 0.10), p90 = quantilePesato(coppieT, 0.90);
    const membriT = [];
    for (const sis of Object.values(ens.sistemi || {})) {
      sis.membri.forEach(mb => { const v = mb.temperature_2m.get(k); if (v !== undefined) membriT.push(v); });
    }
    if (membriT.length > 10) {
      membriT.sort((a, b) => a - b);
      const q = (x) => membriT[Math.min(membriT.length - 1, Math.floor(x * membriT.length))];
      const ampiezzaEns = q(0.9) - q(0.1);
      const ampiezzaFam = (p90 - p10);
      const ampiezza = Math.max(ampiezzaFam, ampiezzaEns * 0.85);
      const semi = Math.max(ampiezza / 2, 0.45 + lead * 0.012);
      p10 = t - semi; p90 = t + semi;
    } else {
      const semi = Math.max((p90 - p10) / 2, 0.5 + lead * 0.014);
      p10 = t - semi; p90 = t + semi;
    }

    // probabilità di pioggia
    const famiglieAttive = Object.keys(pioggiaFam);
    const bagnate = famiglieAttive.filter(f => pioggiaFam[f] >= 0.1);
    const pesoBagnato = somma(bagnate.map(f => pesi[f] || 0));
    const pesoTot = somma(famiglieAttive.map(f => pesi[f] || 0)) || 1;
    const frazioneDet = pesoBagnato / pesoTot;

    const perSistema = [];
    for (const sis of Object.values(ens.sistemi || {})) {
      let tot = 0, sopra = 0;
      sis.membri.forEach(mb => {
        const v = mb.precipitation.get(k);
        if (v !== undefined) { tot++; if (v >= SOGLIA_PIOGGIA) sopra++; }
      });
      if (tot >= 8) perSistema.push(sopra / tot);
    }
    const pEns = perSistema.length ? media(perSistema) : null;
    const pDich = Object.keys(probFam).length
      ? mediaPesata(Object.keys(probFam).map(f => [probFam[f], pesi[f] || 0])) : null;
    const detTarato = applicaCurva(frazioneDet, bins);

    let pezzi = [[detTarato, 0.34]];
    if (pEns !== null) pezzi.push([pEns, 0.48]);
    if (pDich !== null) pezzi.push([pDich, 0.18]);
    const pesoP = somma(pezzi.map(p => p[1]));
    let prob = somma(pezzi.map(p => p[0] * p[1])) / pesoP;
    prob = chiudi(prob, 0, 1);

    // quantità: valore atteso pesato, più lo scenario alto dell'ensemble
    const mmAtteso = mediaPesata(Object.keys(pioggiaFam).map(f => [pioggiaFam[f], pesi[f] || 0])) || 0;
    const membriP = [];
    for (const sis of Object.values(ens.sistemi || {})) {
      sis.membri.forEach(mb => { const v = mb.precipitation.get(k); if (v !== undefined) membriP.push(v); });
    }
    membriP.sort((a, b) => a - b);
    // lo scenario alto è il novantesimo percentile dei membri, ma non può stare
    // sotto il valore atteso dei deterministici, altrimenti si legge come un assurdo
    const mmAlto = Math.max(
      membriP.length ? membriP[Math.floor(0.9 * (membriP.length - 1))] : mmAtteso * 2.2,
      mmAtteso * 1.35
    );

    const nuvole = mediaPesata(Object.keys(nuvoleFam).map(f => [nuvoleFam[f], pesi[f] || 0]));
    const vento = mediaPesata(Object.keys(ventoFam).map(f => [ventoFam[f], pesi[f] || 0]));
    const raffiche = mediaPesata(Object.keys(raficheFam).map(f => [raficheFam[f], pesi[f] || 0]));
    const umidita = mediaPesata(Object.keys(umiditaFam).map(f => [umiditaFam[f], pesi[f] || 0]));
    const neve = mediaPesata(Object.keys(neveFam).map(f => [neveFam[f], pesi[f] || 0])) || 0;

    consenso.push({
      k, lead, t, p10, p90,
      prob, mm: mmAtteso, mmAlto,
      nuvole, vento, raffiche, umidita, neve,
      frazioneDet, pEns, nFamiglie: famiglieAttive.length,
      bagnate, asciutte: famiglieAttive.filter(f => pioggiaFam[f] < 0.1),
      dettaglio, pesi, regime: reg,
      accordoPioggia: 1 - Math.min(1, 2 * Math.min(frazioneDet, 1 - frazioneDet)),
      incertezzaT: p90 - p10,
      cape: ctx.cape && ctx.cape.get(k) !== undefined ? ctx.cape.get(k) : null
    });
  }
  return consenso;
}

/* ---------------- aggregazione giornaliera ---------------- */

function aggregaGiorni(consenso, ens, oggi) {
  const perGiorno = {};
  for (const c of consenso) {
    const g = c.k.slice(0, 10);
    (perGiorno[g] = perGiorno[g] || []).push(c);
  }
  const giorni = [];
  for (const g of Object.keys(perGiorno).sort()) {
    const ore = perGiorno[g];
    if (ore.length < 6) continue;
    const tmax = Math.max(...ore.map(o => o.t)), tmin = Math.min(...ore.map(o => o.t));
    const oraMax = ore.find(o => o.t === tmax), oraMin = ore.find(o => o.t === tmin);

    // probabilità giornaliera calcolata sui totali dei singoli membri, non sommando le ore
    const perSistema = [], totaliMembri = [];
    for (const sis of Object.values(ens.sistemi || {})) {
      let tot = 0, sopra = 0;
      sis.membri.forEach(mb => {
        let acc = 0, visto = false;
        for (const o of ore) { const v = mb.precipitation.get(o.k); if (v !== undefined) { acc += v; visto = true; } }
        if (visto) { tot++; totaliMembri.push(acc); if (acc >= 1.0) sopra++; }
      });
      if (tot >= 8) perSistema.push(sopra / tot);
    }
    const probGiorno = perSistema.length ? media(perSistema) : Math.max(...ore.map(o => o.prob));
    const mm = somma(ore.map(o => o.mm));
    totaliMembri.sort((a, b) => a - b);
    const mmAlto = Math.max(
      totaliMembri.length >= 10
        ? totaliMembri[Math.floor(0.9 * (totaliMembri.length - 1))]
        : somma(ore.map(o => o.mmAlto)) * 0.62,
      mm * 1.25
    );
    const finestre = finestrePioggia(ore);

    const incertezza = media(ore.map(o => o.incertezzaT));
    const accordo = media(ore.filter(o => o.prob > 0.12 || o.mm > 0.05).map(o => o.accordoPioggia));
    const lead = ore[0].lead;
    let fiducia;
    const punteggio = (accordo === null ? 0.8 : accordo) * 0.5
                    + chiudi(1 - (incertezza - 1.2) / 5.5, 0, 1) * 0.3
                    + chiudi(1 - lead / 170, 0, 1) * 0.2;
    fiducia = punteggio > 0.72 ? 'alta' : punteggio > 0.52 ? 'media' : 'bassa';

    giorni.push({
      data: g, ore, tmax, tmin, oraMax: oraMax ? oraMax.k : null, oraMin: oraMin ? oraMin.k : null,
      tmaxP10: oraMax ? oraMax.p10 : tmax, tmaxP90: oraMax ? oraMax.p90 : tmax,
      tminP10: oraMin ? oraMin.p10 : tmin, tminP90: oraMin ? oraMin.p90 : tmin,
      prob: probGiorno, mm, mmAlto, finestre, incertezza, fiducia, punteggio, lead,
      nuvoleMedie: media(ore.map(o => o.nuvole).filter(x => x !== null)),
      ventoMax: Math.max(...ore.map(o => o.raffiche || 0)),
      neve: somma(ore.map(o => o.neve || 0)),
      capeMax: Math.max(...ore.map(o => o.cape || 0)),
      parziale: ore.length < 20
    });
  }
  return giorni;
}

function finestrePioggia(ore, soglia = 0.35) {
  const f = [];
  let apertura = null;
  for (const o of ore) {
    const piove = o.prob >= soglia || o.mm >= 0.25;
    if (piove && !apertura) apertura = { da: o.k, a: o.k, probMax: o.prob, mm: o.mm };
    else if (piove && apertura) { apertura.a = o.k; apertura.probMax = Math.max(apertura.probMax, o.prob); apertura.mm += o.mm; }
    else if (!piove && apertura) { f.push(apertura); apertura = null; }
  }
  if (apertura) f.push(apertura);
  return f.filter(x => x.probMax >= soglia);
}

/* ---------------- ricostruzione delle previsioni passate ---------------- */
/* Consenso a 24 ore di anticipo, a pesi uguali fra famiglie per non barare,
   confrontato con le misure e con i singoli modelli.                      */

function verificaStorica(precedenti, oss) {
  const perGiorno = {};
  const chiavi = new Set();
  for (const m of MODELLI) {
    const s = precedenti.serie[m.id]; if (!s) continue;
    const t = s['temperature_2m_previous_day1']; if (!t) continue;
    t.forEach((_, k) => chiavi.add(k));
  }
  for (const k of [...chiavi].sort()) {
    const vero = oss.temp.get(k);
    const veraP = oss.pioggia.get(k);
    if (vero === undefined) continue;
    const perFam = {}, perFamP = {};
    for (const m of MODELLI) {
      const s = precedenti.serie[m.id]; if (!s) continue;
      const t = s['temperature_2m_previous_day1'], p = s['precipitation_previous_day1'];
      if (t && t.has(k)) (perFam[m.fam] = perFam[m.fam] || []).push({ id: m.id, v: t.get(k) });
      if (p && p.has(k)) (perFamP[m.fam] = perFamP[m.fam] || []).push({ id: m.id, v: p.get(k) });
    }
    const fams = Object.keys(perFam);
    if (fams.length < 6) continue;
    const valori = fams.map(f => media(perFam[f].map(x => x.v))).sort((a, b) => a - b);
    const cons = valori.length % 2 ? valori[(valori.length - 1) / 2]
                                   : (valori[valori.length / 2 - 1] + valori[valori.length / 2]) / 2;
    const g = k.slice(0, 10);
    perGiorno[g] = perGiorno[g] || { data: g, ore: [] };
    const famsP = Object.keys(perFamP);
    const bagnate = famsP.filter(f => media(perFamP[f].map(x => x.v)) >= 0.1).length;
    perGiorno[g].ore.push({
      k, cons, vero,
      prevP: famsP.length ? media(famsP.map(f => media(perFamP[f].map(x => x.v)))) : null,
      fraz: famsP.length ? bagnate / famsP.length : null,
      veraP: veraP === undefined ? null : veraP,
      singoli: Object.values(perFam).flat()
    });
  }

  const righe = [];
  for (const g of Object.keys(perGiorno).sort()) {
    const ore = perGiorno[g].ore;
    if (ore.length < 18) continue;
    const tmaxPrev = Math.max(...ore.map(o => o.cons)), tmaxVero = Math.max(...ore.map(o => o.vero));
    const tminPrev = Math.min(...ore.map(o => o.cons)), tminVero = Math.min(...ore.map(o => o.vero));
    const maeCons = media(ore.map(o => Math.abs(o.cons - o.vero)));
    const perModello = {};
    for (const o of ore) for (const s of o.singoli) {
      (perModello[s.id] = perModello[s.id] || []).push(Math.abs(s.v - o.vero));
    }
    const maeSingoli = Object.entries(perModello)
      .filter(([, v]) => v.length >= ore.length * 0.7)
      .map(([id, v]) => ({ id, mae: media(v) }))
      .sort((a, b) => a.mae - b.mae);
    const mmPrev = somma(ore.map(o => o.prevP || 0));
    const mmVero = somma(ore.map(o => o.veraP || 0));
    righe.push({
      data: g, tmaxPrev, tmaxVero, tminPrev, tminVero, maeCons,
      migliore: maeSingoli[0] || null,
      mediano: maeSingoli.length ? maeSingoli[Math.floor(maeSingoli.length / 2)] : null,
      peggiore: maeSingoli[maeSingoli.length - 1] || null,
      mmPrev, mmVero, ore: ore.length,
      battuti: maeSingoli.filter(s => s.mae > maeCons).length,
      totali: maeSingoli.length
    });
  }
  return righe;
}
