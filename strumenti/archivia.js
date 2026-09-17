/* ============================================================
   PedrengoMeteo - lavoro notturno di archivio
   Gira su GitHub Actions una volta al giorno. Fa le due cose che
   il browser non puo fare a ogni apertura:

   1. guarda indietro novantadue giorni invece di ventuno, il che
      conta soprattutto per la pioggia: in tre mesi ci sono circa
      ottanta ore piovose, in tre settimane sei o sette;
   2. mette da parte la previsione che il sito ha davvero emesso
      oggi, cosi domani e nei giorni seguenti si puo verificare
      quella, e non una ricostruzione fatta col senno di poi.

   I risultati finiscono in dati/, che il sito carica all apertura.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const M = require(path.join(__dirname, '..', 'motore.js'));

const RADICE = path.join(__dirname, '..');
const CARTELLA = path.join(RADICE, 'dati');
const GIORNI_LUNGHI = 92;

function leggiJson(nome, difetto) {
  try { return JSON.parse(fs.readFileSync(path.join(CARTELLA, nome), 'utf8')); }
  catch (e) { return difetto; }
}
function scriviJson(nome, dati) {
  fs.mkdirSync(path.dirname(path.join(CARTELLA, nome)), { recursive: true });
  fs.writeFileSync(path.join(CARTELLA, nome), JSON.stringify(dati, null, 1) + '\n');
  console.log('scritto dati/' + nome);
}
const arrotonda = (v, d = 2) => (v === null || v === undefined || !isFinite(v)) ? null : +v.toFixed(d);

async function principale() {
  const idModelli = M.MODELLI.map(m => m.id).join(',');
  const daLungo = new Date(Date.now() - GIORNI_LUNGHI * 86400e3).toISOString().slice(0, 19);
  const daCorto = new Date(Date.now() - M.GIORNI_VERIFICA * 86400e3).toISOString().slice(0, 19);

  console.log('scarico i dati...');
  const [det, ens, prevCorto, prevLungo, arpaTemp, arpaPioggia] = await Promise.all([
    M.scaricaConRitento(M.urlOpenMeteo('https://api.open-meteo.com/v1/forecast', {
      hourly: M.VARIABILI.join(','), models: idModelli, forecast_days: 7, past_days: 2
    }), 120000),
    M.scaricaConRitento(M.urlOpenMeteo('https://ensemble-api.open-meteo.com/v1/ensemble', {
      hourly: 'temperature_2m,precipitation', models: 'ecmwf_ifs025,icon_eu,gfs025', forecast_days: 7
    }), 120000),
    M.scaricaConRitento(M.urlOpenMeteo('https://previous-runs-api.open-meteo.com/v1/forecast', {
      hourly: ['temperature_2m', 'temperature_2m_previous_day1', 'temperature_2m_previous_day2',
               'temperature_2m_previous_day3', 'precipitation', 'precipitation_previous_day1',
               'precipitation_previous_day2', 'precipitation_previous_day3', 'cloud_cover'].join(','),
      models: idModelli, past_days: M.GIORNI_VERIFICA, forecast_days: 1
    }), 180000),
    M.scaricaConRitento(M.urlOpenMeteo('https://previous-runs-api.open-meteo.com/v1/forecast', {
      hourly: ['precipitation_previous_day1', 'temperature_2m', 'cloud_cover'].join(','),
      models: idModelli, past_days: GIORNI_LUNGHI, forecast_days: 1
    }), 240000),
    M.scaricaConRitento(M.urlArpa(['8145', '19022', '5864'], daLungo, 50000), 180000),
    M.scaricaConRitento(M.urlArpa(['8161', '19026', '5857', '22322'], daLungo, 50000), 180000)
  ]);

  const serieDet = M.leggiMultiModello(det, M.MODELLI.map(m => m.id), M.VARIABILI);
  const serieEns = M.leggiEnsemble(ens);
  const serieCorto = M.leggiMultiModello(prevCorto, M.MODELLI.map(m => m.id),
    ['temperature_2m', 'temperature_2m_previous_day1', 'temperature_2m_previous_day2',
     'temperature_2m_previous_day3', 'precipitation', 'precipitation_previous_day1',
     'precipitation_previous_day2', 'precipitation_previous_day3', 'cloud_cover']);
  const serieLungo = M.leggiMultiModello(prevLungo, M.MODELLI.map(m => m.id),
    ['precipitation_previous_day1', 'temperature_2m', 'cloud_cover']);

  const perSensore = M.aggregaArpa(arpaTemp.concat(arpaPioggia));
  let oss = M.serieOsservate(perSensore);

  // analisi multimodello sulle ore passate, per togliere lo scarto di sito
  const analisi = new Map(), nuvole = new Map();
  for (const fonte of [serieLungo, serieCorto, serieDet]) {
    const perT = new Map(), perN = new Map();
    for (const id of Object.keys(fonte.serie)) {
      const t = fonte.serie[id].temperature_2m, n = fonte.serie[id].cloud_cover;
      if (t) t.forEach((v, k) => { if (!perT.has(k)) perT.set(k, []); perT.get(k).push(v); });
      if (n) n.forEach((v, k) => { if (!perN.has(k)) perN.set(k, []); perN.get(k).push(v); });
    }
    perT.forEach((v, k) => { if (v.length >= 5 && !analisi.has(k)) analisi.set(k, M.media(v)); });
    perN.forEach((v, k) => { if (v.length >= 3 && !nuvole.has(k)) nuvole.set(k, M.media(v)); });
  }

  const allineamento = M.controllaAllineamento(oss.temp, analisi);
  if (allineamento.scarto) {
    oss = { ...oss, temp: M.spostaSerie(oss.temp, allineamento.scarto), pioggia: M.spostaSerie(oss.pioggia, allineamento.scarto) };
  }
  const scartiSito = [];
  oss.temp.forEach((v, k) => { const a = analisi.get(k); if (a !== undefined) scartiSito.push(v - a); });
  scartiSito.sort((a, b) => a - b);
  let offsetSito = null;
  if (scartiSito.length >= 48) {
    offsetSito = scartiSito[Math.floor(scartiSito.length / 2)];
    const corretta = new Map();
    oss.temp.forEach((v, k) => corretta.set(k, v - offsetSito));
    oss = { ...oss, temp: corretta };
  }
  console.log('ore misurate:', oss.temp.size, '| scarto di sito:', arrotonda(offsetSito), 'gradi');

  /* --- 1. taratura lunga della pioggia --- */
  const binsLunghi = M.curvaAffidabilita(serieLungo, oss);
  const orePiovose = [...oss.pioggia.values()].filter(v => v >= M.SOGLIA_PIOGGIA).length;
  scriviJson('taratura.json', {
    aggiornato: new Date().toISOString(),
    giorniGuardati: GIORNI_LUNGHI,
    orePiovoseMisurate: orePiovose,
    oreTotali: oss.pioggia.size,
    bins: binsLunghi.map(b => ({ c: b.c, n: b.n, colpi: b.colpi }))
  });

  /* --- 2. pagella e tarature sulla finestra corta --- */
  const pagella = M.calcolaPagella(serieCorto, oss, nuvole);
  const fascia = M.taraturaFascia(M.ricostruisciPassato(serieCorto, oss, nuvole, pagella));
  const sfasamenti = M.sfasamentoPioggia(serieLungo, oss);
  const zona = M.disomogeneitaPioggia(oss);
  scriviJson('pagella.json', {
    aggiornato: new Date().toISOString(),
    offsetSito: arrotonda(offsetSito),
    fascia: { fattore: arrotonda(fascia.fattore), coperturaPrima: arrotonda(fascia.coperturaPrima, 3), coperturaDopo: arrotonda(fascia.coperturaDopo, 3), nProva: fascia.nProva },
    zona: zona ? { ore: zona.oreDiPioggiaInZona, quota: arrotonda(zona.quotaCheArrivaQui, 3), rapporto: arrotonda(zona.rapportoQuantita, 3) } : null,
    sfasamenti,
    modelli: Object.fromEntries(Object.entries(pagella).map(([id, v]) => [id, {
      mae24: arrotonda(v.per[24] && v.per[24].mae), mae48: arrotonda(v.per[48] && v.per[48].mae),
      mae72: arrotonda(v.per[72] && v.per[72].mae),
      pod: arrotonda(v.per[24] && v.per[24].pod, 3), far: arrotonda(v.per[24] && v.per[24].far, 3),
      scartoMax: arrotonda(v.estremi && v.estremi.max.scarto), campioni: v.campioni
    }]))
  });

  /* --- 3. la previsione emessa oggi, messa da parte per domani --- */
  const adesso = M.chiaveOra(new Date());
  const consenso = M.costruisciConsenso({
    det: serieDet, ens: serieEns, pagella, oss, bins: binsLunghi, adesso,
    cape: new Map(), fascia, sfasamenti
  });
  const giorni = M.aggregaGiorni(consenso, serieEns, adesso.slice(0, 10), pagella);
  const oggi = adesso.slice(0, 10);
  scriviJson('emesse/' + oggi + '.json', {
    emessa: new Date().toISOString(),
    giorni: giorni.map(g => ({
      data: g.data, tmax: arrotonda(g.tmax, 1), tmin: arrotonda(g.tmin, 1),
      prob: arrotonda(g.prob, 3), mm: arrotonda(g.mm, 1), fiducia: g.fiducia,
      parziale: !!g.parziale
    }))
  });

  /* --- 4. verifica delle previsioni emesse nei giorni scorsi --- */
  const osservatoGiorno = {};
  oss.temp.forEach((v, k) => {
    const g = k.slice(0, 10);
    osservatoGiorno[g] = osservatoGiorno[g] || { tmax: -99, tmin: 99, mm: 0, ore: 0 };
    osservatoGiorno[g].tmax = Math.max(osservatoGiorno[g].tmax, v);
    osservatoGiorno[g].tmin = Math.min(osservatoGiorno[g].tmin, v);
    osservatoGiorno[g].ore++;
  });
  oss.pioggia.forEach((v, k) => {
    const g = k.slice(0, 10);
    if (osservatoGiorno[g]) osservatoGiorno[g].mm += v;
  });

  const verifiche = leggiJson('verifiche.json', { righe: [] });
  const gia = new Set(verifiche.righe.map(r => r.emessa + '|' + r.giorno));
  let nuove = 0;
  const cartellaEmesse = path.join(CARTELLA, 'emesse');
  const file = fs.existsSync(cartellaEmesse) ? fs.readdirSync(cartellaEmesse).filter(f => f.endsWith('.json')) : [];
  for (const f of file) {
    const emessa = f.replace('.json', '');
    if (emessa === oggi) continue;
    const contenuto = leggiJson('emesse/' + f, null);
    if (!contenuto || !contenuto.giorni) continue;
    for (const g of contenuto.giorni) {
      if (g.parziale) continue;
      if (g.data >= oggi) continue;
      if (gia.has(emessa + '|' + g.data)) continue;
      const vero = osservatoGiorno[g.data];
      if (!vero || vero.ore < 20) continue;
      const lead = Math.round((Date.parse(g.data) - Date.parse(emessa)) / 86400e3);
      verifiche.righe.push({
        emessa, giorno: g.data, lead,
        tmaxPrev: g.tmax, tmaxVero: arrotonda(vero.tmax, 1),
        tminPrev: g.tmin, tminVero: arrotonda(vero.tmin, 1),
        probPrev: g.prob, mmPrev: g.mm, mmVero: arrotonda(vero.mm, 1),
        piovuto: vero.mm >= 1 ? 1 : 0, fiducia: g.fiducia
      });
      nuove++;
    }
  }
  verifiche.righe.sort((a, b) => (a.giorno + a.emessa) < (b.giorno + b.emessa) ? -1 : 1);
  if (verifiche.righe.length > 4000) verifiche.righe = verifiche.righe.slice(-4000);
  verifiche.aggiornato = new Date().toISOString();

  // riassunto per anticipo, cosi il sito puo mostrarlo senza ricalcolare
  const perLead = {};
  for (const r of verifiche.righe) {
    if (r.tmaxVero === null || r.tmaxPrev === null) continue;
    const L = perLead[r.lead] = perLead[r.lead] || { n: 0, sommaErrMax: 0, sommaScartoMax: 0, brier: 0, nProb: 0 };
    L.n++;
    L.sommaErrMax += Math.abs(r.tmaxPrev - r.tmaxVero);
    L.sommaScartoMax += (r.tmaxPrev - r.tmaxVero);
    if (r.probPrev !== null && r.probPrev !== undefined) { L.brier += Math.pow(r.probPrev - r.piovuto, 2); L.nProb++; }
  }
  verifiche.riassunto = Object.fromEntries(Object.entries(perLead).map(([lead, L]) => [lead, {
    giorni: L.n,
    erroreMassima: arrotonda(L.sommaErrMax / L.n),
    scartoMassima: arrotonda(L.sommaScartoMax / L.n),
    brierPioggia: L.nProb ? arrotonda(L.brier / L.nProb, 4) : null
  }]));
  scriviJson('verifiche.json', verifiche);

  // le previsioni emesse piu vecchie di un anno non servono piu
  const limite = new Date(Date.now() - 400 * 86400e3).toISOString().slice(0, 10);
  for (const f of file) if (f.replace('.json', '') < limite) fs.unlinkSync(path.join(cartellaEmesse, f));

  console.log('verifiche nuove:', nuove, '| totale righe:', verifiche.righe.length);
  console.log('riassunto per anticipo:', JSON.stringify(verifiche.riassunto));
}

principale().catch(e => { console.error('archivio fallito:', e); process.exit(1); });
