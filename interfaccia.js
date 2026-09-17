/* ============================================================
   PedrengoMeteo - interfaccia
   ============================================================ */

const $ = s => document.querySelector(s);
const STATO = { consenso: [], giorni: [], pagella: {}, verifica: [], oss: null, det: null, ens: null,
                bins: null, offsetSito: null, ventaglio: { variabile: 'temperatura', finestra: 48 }, tempi: {} };

const g1 = n => (n === null || n === undefined || !isFinite(n)) ? '-' : n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const g0 = n => (n === null || n === undefined || !isFinite(n)) ? '-' : Math.round(n).toLocaleString('it-IT');
const pc = n => (n === null || n === undefined || !isFinite(n)) ? '-' : Math.round(n * 100) + '%';
const oraDi = k => k.slice(11, 13) + ':00';
const GIORNI_NOME = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function nomeGiorno(dataStr, oggi) {
  const d = dataDaChiave(dataStr + 'T12');
  const diff = Math.round((dataDaChiave(dataStr + 'T12') - dataDaChiave(oggi + 'T12')) / 86400e3);
  if (diff === 0) return 'oggi';
  if (diff === 1) return 'domani';
  if (diff === 2) return 'dopodomani';
  return GIORNI_NOME[d.getDay()];
}
function dataBreve(dataStr) {
  const d = dataDaChiave(dataStr + 'T12');
  return d.getDate() + ' ' + MESI[d.getMonth()].slice(0, 3);
}

/* ---------------- simboli ---------------- */

function icona(tipo, dim = 22) {
  return `<svg viewBox="0 0 24 26" width="${dim}" height="${dim * 26 / 24}" aria-hidden="true" style="flex:none">${corpoIcona(tipo)}</svg>`;
}

function corpoIcona(tipo) {
  const c = 'stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  const nuvola = `<path d="M7 18h9.2a3.4 3.4 0 0 0 .3-6.8 5 5 0 0 0-9.5-1.1A3.5 3.5 0 0 0 7 18z" ${c}/>`;
  const sole = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" ${c}/>` +
    [0, 45, 90, 135, 180, 225, 270, 315].map(a => {
      const rad = a * Math.PI / 180;
      return `<line x1="${(cx + Math.cos(rad) * (r + 2)).toFixed(1)}" y1="${(cy + Math.sin(rad) * (r + 2)).toFixed(1)}" x2="${(cx + Math.cos(rad) * (r + 4)).toFixed(1)}" y2="${(cy + Math.sin(rad) * (r + 4)).toFixed(1)}" ${c}/>`;
    }).join('');
  const luna = `<path d="M17 14.6A6.4 6.4 0 0 1 9.4 7a6.4 6.4 0 1 0 7.6 7.6z" ${c}/>`;
  const gocce = n => Array.from({ length: n }, (_, i) =>
    `<line x1="${8.5 + i * 3.6}" y1="19.4" x2="${7.3 + i * 3.6}" y2="22.4" ${c}/>`).join('');
  const fiocchi = n => Array.from({ length: n }, (_, i) =>
    `<g transform="translate(${8.6 + i * 3.6} 21)"><line x1="-1.6" y1="0" x2="1.6" y2="0" ${c}/><line x1="0" y1="-1.6" x2="0" y2="1.6" ${c}/></g>`).join('');
  const fulmine = `<path d="M13.6 17.6h2.6l-4.4 5.6 1-3.8H10.4l3.4-5.2z" ${c}/>`;
  let corpo;
  switch (tipo) {
    case 'sereno':    corpo = sole(12, 12, 4.4); break;
    case 'notte':     corpo = luna; break;
    case 'poco':      corpo = sole(9, 8.5, 3.2) + nuvola; break;
    case 'poco-notte':corpo = `<path d="M13.6 9.4A4.6 4.6 0 0 1 8.2 4a4.6 4.6 0 1 0 5.4 5.4z" ${c}/>` + nuvola; break;
    case 'nuvoloso':  corpo = nuvola; break;
    case 'coperto':   corpo = `<path d="M4.6 14.4a2.9 2.9 0 0 1 1.9-5 4.3 4.3 0 0 1 7.6-1.4" ${c}/>` + nuvola; break;
    case 'debole':    corpo = nuvola + gocce(2); break;
    case 'pioggia':   corpo = nuvola + gocce(3); break;
    case 'rovesci':   corpo = nuvola + gocce(4); break;
    case 'temporale': corpo = nuvola + fulmine; break;
    case 'neve':      corpo = nuvola + fiocchi(3); break;
    case 'nebbia':    corpo = `<line x1="4" y1="9" x2="20" y2="9" ${c}/><line x1="5.5" y1="13" x2="18.5" y2="13" ${c}/><line x1="4" y1="17" x2="20" y2="17" ${c}/>`; break;
    default:          corpo = nuvola;
  }
  return corpo;
}

/* Notte vera, presa da alba e tramonto del giorno, non da un orario fisso:
   a meta dicembre a Pedrengo fa buio alle 16:40, a fine giugno alle 21:05. */
function eNotte(k) {
  const s = STATO.sole && STATO.sole[k.slice(0, 10)];
  const ora = +k.slice(11, 13);
  if (!s) return ora >= 20 || ora < 6;
  return ora < Math.floor(s.alba) || ora >= Math.floor(s.tramonto);
}

function tipoTempo(o) {
  const ora = +o.k.slice(11, 13);
  const notte = eNotte(o.k);
  if (o.neve > 0.15 && o.t < 2.5) return ['neve', 'neve'];
  if ((o.cape || 0) >= 800 && o.prob >= 0.35 && o.mm >= 0.4) return ['temporale', 'temporali'];
  if (o.mm >= 2.5) return ['rovesci', 'rovesci'];
  if (o.mm >= 0.6) return ['pioggia', 'pioggia'];
  if (o.mm >= 0.12 || o.prob >= 0.45) return ['debole', 'pioggia debole'];
  if (o.umidita >= 96 && (o.nuvole || 0) < 45 && (o.vento || 0) < 7 && (ora < 10 || ora >= 21)) return ['nebbia', 'nebbia'];
  const n = o.nuvole === null ? 50 : o.nuvole;
  if (n < 22) return [notte ? 'notte' : 'sereno', 'sereno'];
  if (n < 58) return [notte ? 'poco-notte' : 'poco', 'poco nuvoloso'];
  if (n < 85) return ['nuvoloso', 'nuvoloso'];
  return ['coperto', 'coperto'];
}

function tipoGiorno(g) {
  const forte = g.ore.reduce((a, o) => o.mm > a.mm ? o : a, g.ore[0]);
  if (g.mm >= 0.8 || g.prob >= 0.5) return tipoTempo({ ...forte, k: g.data + 'T13' });
  const diurne = g.ore.filter(o => { const h = +o.k.slice(11, 13); return h >= 8 && h <= 19; });
  const rif = diurne.length ? diurne : g.ore;
  return tipoTempo({
    k: g.data + 'T13', t: g.tmax, mm: g.mm / 24, prob: g.prob, neve: g.neve,
    nuvole: media(rif.map(o => o.nuvole).filter(x => x !== null)),
    umidita: media(rif.map(o => o.umidita).filter(x => x !== null)),
    vento: media(rif.map(o => o.vento).filter(x => x !== null)), cape: g.capeMax
  });
}

/* ---------------- stato in testa ---------------- */

function stato(testo, classe) {
  $('#stato-testo').textContent = testo;
  const p = $('#stato-pallino');
  p.className = 'pallino' + (classe ? ' ' + classe : '');
}
function passo(n) {
  const b = $('#avanzamento').children;
  for (let i = 0; i < b.length; i++) b[i].classList.toggle('fatto', i < n);
}

/* ---------------- adesso ---------------- */

function rendiEroe() {
  const { oss, consenso, ultimi, giorni } = STATO;
  const adesso = consenso[0];
  const kOra = chiaveOra(new Date());
  const tOss = oss.temp.get(kOra) !== undefined ? oss.temp.get(kOra) : oss.temp.get(chiaveDa(kOra, -1));
  const pioggiaOra = oss.pioggia.get(kOra);
  const ultimaT = ultimi['8145'] || ultimi['5864'];
  const ultimaU = ultimi['6158'];
  const ultimoV = ultimi['19103'];

  let pioggiaOggi = 0;
  const oggiChiave = kOra.slice(0, 10);
  oss.pioggia.forEach((v, k) => { if (k.slice(0, 10) === oggiChiave) pioggiaOggi += v; });

  const scarto = (tOss !== undefined && adesso) ? (adesso.t - tOss) : null;
  const [ic, testo] = adesso ? tipoTempo(adesso) : ['nuvoloso', 'in attesa'];
  $('#top-temp').textContent = tOss !== undefined ? g1(tOss) + ' °C' : '';

  /* colonna di sinistra: il numero misurato adesso, e quanto i modelli
     lo stanno sbagliando proprio in questo momento */
  let scartoTesto = '';
  if (scarto !== null) {
    const colore = Math.abs(scarto) < 0.7 ? 'var(--ok)' : Math.abs(scarto) < 1.6 ? 'var(--attesa)' : 'var(--allerta)';
    const giudizio = Math.abs(scarto) < 0.7 ? 'i modelli ci stanno prendendo'
      : Math.abs(scarto) < 1.6 ? 'scarto contenuto'
      : scarto > 0 ? 'i modelli sovrastimano' : 'i modelli sottostimano';
    scartoTesto = `<div class="ora-scarto">i modelli davano <b>${g1(adesso.t)} °C</b> per quest'ora<br>
      scarto <b style="color:${colore}">${scarto > 0 ? '+' : ''}${g1(scarto)} °C</b>, ${giudizio}</div>`;
  }
  $('#eroe-ora').innerHTML = `
    <span class="etichetta">Adesso · misurato, non previsto</span>
    <div class="ora-grande">
      <div class="cifra">${tOss !== undefined ? g1(tOss) : '-'}<sup>°C</sup></div>
      <div class="ora-lato">
        <div class="ora-desc">${icona(ic, 22)}<span>${testo}</span></div>
        ${scartoTesto}
      </div>
    </div>`;

  /* colonna di destra: la giornata in cinque righe */
  const oggi = giorni[0];
  if (oggi) {
    /* L arco copre la giornata da minima a massima, e la pallina dice dove ci
       troviamo adesso dentro quell escursione. */
    const campo = Math.max(0.5, oggi.tmax - oggi.tmin);
    const dove = tOss === undefined ? null : chiudi((tOss - oggi.tmin) / campo, 0, 1) * 100;
    $('#eroe-oggi').innerHTML = `
      <span class="etichetta">Oggi a Pedrengo</span>
      <div class="arco">
        <span class="binario"></span>
        <span class="tratto" style="left:0; right:0"></span>
        ${dove === null ? '' : `<span class="segno" style="left:${dove.toFixed(1)}%"></span>
        ${(dove >= 20 && dove <= 80) ? `<span class="adesso-et" style="left:${dove.toFixed(1)}%">ora</span>` : ''}`}
        <span class="cap" style="left:0; color:var(--blu)">${g1(oggi.tmin)}</span>
        <span class="cap" style="right:0; color:var(--arancio)">${g1(oggi.tmax)}</span>
      </div>
      <div class="oggi-righe">
        <div class="oggi-riga"><span>probabilità di pioggia</span><b>${pc(oggi.prob)}${oggi.mm >= 0.15 ? ' · ' + g1(oggi.mm) + ' mm' : ''}</b></div>
        <div class="oggi-riga"><span>caduta finora</span><b>${g1(pioggiaOggi)} mm</b></div>
        <div class="oggi-riga"><span>umidità e vento</span><b>${ultimaU ? g0(ultimaU.v) + '%' : '-'}${ultimoV ? ' · ' + g1(ultimoV.v) + ' m/s' : ''}</b></div>
        <div class="oggi-riga"><span>accordo fra i centri</span><b><span class="chip ${oggi.fiducia}">${oggi.fiducia}</span></b></div>
      </div>`;
  }

  /* striscia delle prossime dodici ore */
  const prossime = consenso.slice(1, 13);
  $('#eroe-strip').innerHTML = prossime.map((o) => {
    const [ico] = tipoTempo(o);
    const prob = Math.round(o.prob * 100);
    return `<div class="cella-ora${eNotte(o.k) ? ' buio' : ''}">
      <span class="qora">${oraDi(o.k).slice(0, 2)}</span>
      ${icona(ico, 20)}
      <span class="qt">${g1(o.t)}°</span>
      <span class="qp${prob < 15 ? ' zero' : ''}">${prob}%</span>
    </div>`;
  }).join('');

  const nStazioni = STATO.stazioniAttive || 0;
  $('#eroe-fonte').innerHTML = `Temperatura misurata da ${nStazioni} stazioni ARPA Lombardia attorno al paese, pesate per distanza, riportate alla quota di Pedrengo e ripulite dallo scarto sistematico della loro posizione${STATO.offsetSito !== null ? ' (' + (STATO.offsetSito > 0 ? '+' : '') + g1(STATO.offsetSito) + ' °C)' : ''}.${ultimaT ? ' Ultima lettura delle ' + ultimaT.ora + '.' : ''} Lo scarto qui sopra viene riusato per riallineare le ore successive.`;
}

/* ---------------- nowcasting ---------------- */

function rendiNowcast() {
  const n = STATO.nowcast;
  const box = $('#blocco-nowcast');
  if (!n) {
    box.innerHTML = '<p class="vuoto">Nowcasting non disponibile: né il radar né i modelli a quindici minuti hanno risposto.</p>';
    return;
  }
  const classe = n.livello === 'piove' ? 'piove' : n.livello === 'in arrivo' ? 'arrivo' : 'asciutto';
  const simbolo = n.livello === 'piove' ? 'pioggia' : n.livello === 'in arrivo' ? 'nuvoloso' : 'sereno';

  const passi = n.prossime.slice(0, 12);
  const massimo = Math.max(0.25, ...passi.map(p => p.mm));
  // le colonne servono solo se c e qualcosa da mostrare, altrimenti sono dodici scatole vuote
  const valeLaPena = passi.some(p => p.mm > 0.02);
  const barre = passi.map((p, i) => `
    <div class="quarto" title="${p.etichetta}: ${g1(p.mm)} mm nel quarto d'ora">
      <div class="colonna"><i style="height:${p.mm > 0.005 ? Math.max(2, Math.round(p.mm / massimo * 52)) : 0}px"></i></div>
      <small>${i % 4 === 0 ? p.etichetta : ''}</small>
    </div>`).join('');

  let radarTesto;
  if (!n.radar) {
    radarTesto = 'Radar non raggiunto in questo momento, il verdetto qui sopra usa solo modelli e pluviometri.';
  } else {
    const r = n.radar;
    const ora = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(r.ora);
    const pezzi = [`Radar delle ${ora}, ${r.frame} scansioni sull'ultima ora`];
    if (r.sopraIlPaese) pezzi.push('eco sopra il paese');
    else if (r.distanzaVicino !== null) pezzi.push(`eco più vicino a ${g0(r.distanzaVicino)} km a ${r.direzioneVicino}`);
    else pezzi.push('nessun eco nel raggio coperto');
    if (r.moto && r.moto.affidabile && r.moto.kmh > 3) pezzi.push(`si muove verso ${r.moto.verso} a ${g0(r.moto.kmh)} km/h`);
    else if (r.moto && r.moto.affidabile) pezzi.push('campo di pioggia quasi fermo');
    else pezzi.push('movimento non determinabile in modo netto');
    if (r.quotaFissa > 0.25) pezzi.push(`${pc(r.quotaFissa)} dell'eco è fisso sui rilievi e viene scartato`);
    radarTesto = pezzi.join(', ') + '.';
  }

  const pluvio = n.pluvio;
  box.innerHTML = `
    <div class="verdetto ${classe}">
      <span class="icona-grande">${icona(simbolo, 34)}</span>
      <span class="testo">
        <h3>${n.titolo}</h3>
        <p>${n.dettaglio}</p>
        ${(passi.length && valeLaPena) ? `<div class="quarti">${barre}</div>
          <p style="margin-top:8px; font-size:12px; color:var(--ink-3)">Millimetri per quarto d'ora, consenso di ${MODELLI_FINI.length} modelli ad alta risoluzione. ${n.mmDueOre >= 0.05 ? 'Totale atteso nelle prossime due ore ' + g1(n.mmDueOre) + ' mm.' : ''}</p>` : ''}
        <div class="riga-radar">${radarTesto}${pluvio.ultimeTreOre > 0.05 ? ` Nelle ultime tre ore i pluviometri hanno raccolto ${g1(pluvio.ultimeTreOre)} mm.` : ''}</div>
      </span>
    </div>`;
}

async function avviaNowcast() {
  try {
    const [r, q] = await Promise.allSettled([leggiRadar(), leggiQuartiDora()]);
    const radar = r.status === 'fulfilled' ? r.value : null;
    const quarti = q.status === 'fulfilled' ? q.value : null;
    if (!radar && !quarti) { STATO.nowcast = null; rendiNowcast(); return; }
    STATO.nowcast = costruisciNowcast(radar, quarti, tendenzaPluviometri(STATO.oss));
    rendiNowcast();
  } catch (e) {
    STATO.nowcast = null;
    rendiNowcast();
    console.error('nowcast', e);
  }
}

/* ---------------- bollettino ---------------- */

function elencoOre(f) {
  const da = +f.da.slice(11, 13), a = +f.a.slice(11, 13);
  if (da === a) return 'verso le ' + da;
  return 'fra le ' + da + ' e le ' + (a + 1);
}

const TIPI_PRECIPITAZIONE = ['pioggia', 'pioggia debole', 'rovesci', 'temporali', 'neve', 'nebbia'];
const piovoso = testo => TIPI_PRECIPITAZIONE.includes(testo) && testo !== 'nebbia';
function fraseCielo(testo) {
  return TIPI_PRECIPITAZIONE.includes(testo) ? testo : 'cielo ' + testo;
}

function rendiBollettino() {
  const { giorni, consenso, pagella } = STATO;
  if (!giorni.length) return;
  const oggi = giorni[0], domani = giorni[1];
  const frasi = [];

  const [, testoOggi] = tipoGiorno(oggi);
  const oraAdesso = +chiaveOra(new Date()).slice(11, 13);
  const restaOggi = oggi.ore.filter(o => +o.k.slice(11, 13) >= oraAdesso);
  const maxResta = restaOggi.length ? Math.max(...restaOggi.map(o => o.t)) : oggi.tmax;

  frasi.push(`${oggi.parziale ? 'Per il resto di oggi' : 'Oggi'} a Pedrengo ${fraseCielo(testoOggi)}, massima ${g1(maxResta)} gradi e minima ${g1(oggi.tmin)}, con un margine di ${g1(oggi.incertezza / 2)} gradi in più o in meno.`);

  const finestreOggi = oggi.finestre.filter(f => +f.a.slice(11, 13) >= oraAdesso);
  if (finestreOggi.length) {
    const f = finestreOggi[0];
    const oraPicco = oggi.ore.find(o => o.k >= f.da && o.k <= f.a && o.prob >= f.probMax - 0.01) || oggi.ore.find(o => o.k === f.da);
    frasi.push(`Pioggia ${elencoOre(f)}, probabilità ${pc(f.probMax)}, quantità attesa ${g1(f.mm)} mm e fino a ${g1(oggi.mmAlto)} mm nello scenario più bagnato. In questo momento ${oraPicco.bagnate.length} centri su ${oraPicco.nFamiglie} vedono precipitazione in quella finestra${oraPicco.asciutte.length ? ', gli altri no' : ''}.`);
  } else if (oggi.prob < 0.15) {
    frasi.push(`Nessun modello vede pioggia significativa oggi: la probabilità resta sotto il ${Math.max(5, Math.round(oggi.prob * 100))} per cento per tutta la giornata.`);
  } else {
    frasi.push(`Pioggia poco probabile oggi, ${pc(oggi.prob)} sulla giornata, senza una finestra definita.`);
  }

  if (domani) {
    const [, testoDom] = tipoGiorno(domani);
    let f2 = `Domani ${fraseCielo(testoDom)}, da ${g1(domani.tmin)} a ${g1(domani.tmax)} gradi`;
    if (domani.finestre.length) {
      const f = domani.finestre[0];
      f2 += piovoso(testoDom)
        ? `, fase più intensa ${elencoOre(f)}, in tutto ${g1(domani.mm)} mm attesi e fino a ${g1(domani.mmAlto)} nello scenario alto`
        : `, con pioggia ${elencoOre(f)} (${pc(f.probMax)}, ${g1(domani.mm)} mm attesi)`;
    } else if (domani.prob < 0.2) f2 += ', senza pioggia in vista';
    else f2 += `, probabilità di pioggia ${pc(domani.prob)}`;
    frasi.push(f2 + '.');
  }

  const fragile = giorni.slice(0, 4).find(g => g.fiducia === 'bassa');
  if (fragile) {
    const nome = nomeGiorno(fragile.data, giorni[0].data);
    const testa = nome === 'oggi' ? 'Attenzione, oggi' : `Attenzione a ${nome}:`;
    frasi.push(`${testa} i modelli si dividono, la dispersione sulla temperatura è di ${g1(fragile.incertezza)} gradi e sulla pioggia non c'è accordo. Quella previsione va presa con cautela e riguardata al prossimo aggiornamento.`);
  }

  const ventoso = giorni.slice(0, 4).find(g => g.ventoMax >= 45);
  if (ventoso) frasi.push(`Raffiche fino a ${g0(ventoso.ventoMax)} km/h ${nomeGiorno(ventoso.data, giorni[0].data)}.`);

  const temporali = giorni.slice(0, 5).find(g => g.capeMax >= 900 && g.prob >= 0.3);
  if (temporali && !fragile) frasi.push(`Energia convettiva alta ${nomeGiorno(temporali.data, giorni[0].data)} (${g0(temporali.capeMax)} J/kg): se piove, piove a rovesci e in modo disuguale fra una via e l'altra.`);

  const lontani = giorni.slice(4);
  if (lontani.length) {
    const tm = media(lontani.map(g => g.tmax));
    const vicini = media(giorni.slice(0, 3).map(g => g.tmax));
    const verso = tm - vicini;
    frasi.push(`Da ${nomeGiorno(lontani[0].data, giorni[0].data)} in poi le massime ${Math.abs(verso) < 1 ? 'restano sui ' + g1(tm) + ' gradi' : (verso > 0 ? 'salgono verso i ' + g1(tm) : 'scendono verso i ' + g1(tm)) + ' gradi'}, ma oltre il quinto giorno l'errore medio dei modelli qui supera i ${g1(Math.max(1.5, media(Object.values(pagella).map(v => v.per[72] ? v.per[72].mae : null).filter(Boolean)) * 1.25))} gradi: è una tendenza, non una previsione.`);
  }

  $('#bollettino').innerHTML = frasi.map(f => `<p>${f}</p>`).join('');
  const nMod = Object.keys(STATO.det.serie).length;
  const nVer = somma(Object.values(pagella).map(v => v.campioni));
  $('#firma-bollettino').textContent = `Scritto dai numeri di ${nMod} modelli, pesati su ${g0(nVer)} confronti con le stazioni. Aggiornato alle ${new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(new Date())}.`;
}

/* ---------------- grafico 48 ore ---------------- */

function disegnaOre() {
  const box = $('#tela-ore');
  const W = Math.max(300, Math.floor(box.clientWidth) - 16);
  const stretto = W < 560;
  const n = Math.min(STATO.consenso.length, stretto ? 24 : 48);
  const dati = STATO.consenso.slice(0, n);
  if (!dati.length) return;

  const ML = 32, MR = 8, MT = 6;
  const HIC = 26;                                   // fascia delle icone del cielo
  const HT = stretto ? 102 : 126, GAP = 30, HP = stretto ? 52 : 62, HX = 22;
  const TOP = MT + HIC;
  const H = TOP + HT + GAP + HP + HX;
  const larg = (W - ML - MR) / n;
  const x = i => ML + (i + 0.5) * larg;
  const bordo = i => ML + i * larg;

  const tutti = dati.flatMap(d => [d.p10, d.p90]);
  let tMin = Math.min(...tutti), tMax = Math.max(...tutti);
  const pad = Math.max(0.8, (tMax - tMin) * 0.12);
  tMin = Math.floor(tMin - pad); tMax = Math.ceil(tMax + pad);
  const y = v => TOP + HT - ((v - tMin) / (tMax - tMin)) * HT;
  const yP = p => TOP + HT + GAP + HP - p * HP;

  let s = '';

  /* Buio vero, da tramonto ad alba, non un orario fisso. Le fasce sono
     disegnate con posizione frazionaria, cosi il bordo cade sull ora giusta. */
  const t0 = dataDaChiave(dati[0].k).getTime();
  const giorniVisti = [...new Set(dati.map(d => d.k.slice(0, 10)))];
  const fasce = [];
  for (const g of giorniVisti) {
    const sole = STATO.sole && STATO.sole[g];
    const base = (dataDaChiave(g + 'T00').getTime() - t0) / 3600e3;
    if (sole) {
      fasce.push([base, base + sole.alba]);
      fasce.push([base + sole.tramonto, base + 24]);
    } else {
      fasce.push([base, base + 6]);
      fasce.push([base + 20, base + 24]);
    }
  }
  for (const [da, a] of fasce) {
    const i0 = Math.max(0, da), i1 = Math.min(n, a);
    if (i1 <= i0) continue;
    s += `<rect class="notte" x="${bordo(i0).toFixed(1)}" y="${TOP}" width="${(bordo(i1) - bordo(i0)).toFixed(1)}" height="${HT}"/>`;
  }

  // icone del cielo sopra il grafico, una ogni tre ore
  const passoIcona = stretto ? 6 : 3;
  const scalaIcona = stretto ? 0.72 : 0.82;
  dati.forEach((d, i) => {
    if (+d.k.slice(11, 13) % passoIcona !== 0) return;
    const [ico] = tipoTempo(d);
    s += `<g class="icona-grafico" transform="translate(${(x(i) - 12 * scalaIcona).toFixed(1)},${MT}) scale(${scalaIcona})">${corpoIcona(ico)}</g>`;
  });

  // griglia temperatura
  const passoT = (tMax - tMin) > 16 ? 5 : (tMax - tMin) > 8 ? 2 : 1;
  for (let v = Math.ceil(tMin / passoT) * passoT; v <= tMax; v += passoT) {
    s += `<line class="gx-lieve" x1="${ML}" y1="${y(v).toFixed(1)}" x2="${W - MR}" y2="${y(v).toFixed(1)}"/>`;
    s += `<text class="et-asse" x="${ML - 6}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${v}</text>`;
  }

  // fascia di incertezza e linea
  const su = dati.map((d, i) => `${x(i).toFixed(1)},${y(d.p90).toFixed(1)}`);
  const giu = dati.map((d, i) => `${x(i).toFixed(1)},${y(d.p10).toFixed(1)}`).reverse();
  s += `<polygon class="fascia-t" points="${su.concat(giu).join(' ')}"/>`;
  s += `<polyline class="linea-t" points="${dati.map((d, i) => `${x(i).toFixed(1)},${y(d.t).toFixed(1)}`).join(' ')}"/>`;

  // estremi etichettati
  const iMax = dati.reduce((a, d, i) => d.t > dati[a].t ? i : a, 0);
  const iMin = dati.reduce((a, d, i) => d.t < dati[a].t ? i : a, 0);
  for (const i of [iMax, iMin]) {
    s += `<circle class="punto-t" cx="${x(i).toFixed(1)}" cy="${y(dati[i].t).toFixed(1)}" r="3.4"/>`;
    s += `<text class="et-mm" style="fill:var(--arancio)" x="${x(i).toFixed(1)}" y="${(y(dati[i].t) + (i === iMax ? -8 : 15)).toFixed(1)}" text-anchor="middle">${g1(dati[i].t)}</text>`;
  }

  // pannello pioggia
  s += `<line class="zero" x1="${ML}" y1="${yP(0)}" x2="${W - MR}" y2="${yP(0)}"/>`;
  for (const p of [0.5, 1]) {
    s += `<line class="gx-lieve" x1="${ML}" y1="${yP(p).toFixed(1)}" x2="${W - MR}" y2="${yP(p).toFixed(1)}"/>`;
    s += `<text class="et-asse" x="${ML - 6}" y="${(yP(p) + 3.5).toFixed(1)}" text-anchor="end">${p * 100}</text>`;
  }
  let ultimaEt = -9;
  dati.forEach((d, i) => {
    const h = Math.max(d.prob > 0.02 ? 1.5 : 0, d.prob * HP);
    if (h > 0) s += `<rect class="barra-p" x="${(x(i) - larg * 0.34).toFixed(1)}" y="${(yP(d.prob)).toFixed(1)}" width="${(larg * 0.68).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"/>`;
    if (d.mm >= 0.3 && i - ultimaEt >= (stretto ? 4 : 3)) {
      s += `<text class="et-mm" x="${x(i).toFixed(1)}" y="${(yP(d.prob) - 4).toFixed(1)}" text-anchor="middle">${g1(d.mm)}</text>`;
      ultimaEt = i;
    }
  });

  // asse orario e separatori di giorno
  const ogni = stretto ? 6 : 3;
  dati.forEach((d, i) => {
    const h = +d.k.slice(11, 13);
    if (h === 0 && i > 0) {
      const px = (ML + i * larg).toFixed(1);
      s += `<line class="gx" x1="${px}" y1="${TOP}" x2="${px}" y2="${TOP + HT + GAP + HP}"/>`;
      s += `<text class="et-giorno" x="${(+px + 5).toFixed(1)}" y="${TOP + 11}">${nomeGiorno(d.k.slice(0, 10), dati[0].k.slice(0, 10)).slice(0, 3)}</text>`;
    }
    if (h % ogni === 0) s += `<text class="et-asse" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${String(h).padStart(2, '0')}</text>`;
  });

  // alba e tramonto scritti alla base, dove cade il cambio di fascia
  for (const g of giorniVisti) {
    const sole = STATO.sole && STATO.sole[g];
    if (!sole) continue;
    const base = (dataDaChiave(g + 'T00').getTime() - t0) / 3600e3;
    for (const [ore, testo] of [[sole.alba, sole.albaTesto], [sole.tramonto, sole.tramontoTesto]]) {
      const idx = base + ore;
      if (idx < 0.6 || idx > n - 0.6) continue;
      const px = bordo(idx);
      s += `<line class="gx-lieve" x1="${px.toFixed(1)}" y1="${TOP}" x2="${px.toFixed(1)}" y2="${TOP + HT}"/>`;
      if (!stretto) s += `<text class="sole-et" x="${px.toFixed(1)}" y="${(TOP + HT + 11).toFixed(1)}" text-anchor="middle">${testo}</text>`;
    }
  }

  s += `<rect id="cattura-ore" x="${ML}" y="${TOP}" width="${W - ML - MR}" height="${HT + GAP + HP}" fill="transparent" style="cursor:crosshair"/>`;
  s += `<line id="mirino-ore" class="mirino" x1="0" y1="${TOP}" x2="0" y2="${TOP + HT + GAP + HP}" style="opacity:0"/>`;

  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Temperatura e probabilità di pioggia ora per ora">${s}</svg>
    <div class="suggerimento" id="sug-ore"></div>`;
  $('#legenda-ore').hidden = false;

  const svg = box.querySelector('svg'), sug = $('#sug-ore'), mirino = $('#mirino-ore');
  const indiceDa = ev => {
    const r = svg.getBoundingClientRect();
    const px = (ev.clientX - r.left) * (W / r.width);
    return chiudi(Math.floor((px - ML) / larg), 0, n - 1);
  };
  const mostra = ev => {
    const i = indiceDa(ev), d = dati[i];
    const [, testo] = tipoTempo(d);
    mirino.setAttribute('x1', x(i)); mirino.setAttribute('x2', x(i)); mirino.style.opacity = '1';
    sug.innerHTML = `<h4>${nomeGiorno(d.k.slice(0, 10), dati[0].k.slice(0, 10))} ${oraDi(d.k)}</h4>
      <div class="sug-riga"><span>temperatura</span><b>${g1(d.t)} °C</b></div>
      <div class="sug-riga"><span>intervallo</span><b>${g1(d.p10)} / ${g1(d.p90)}</b></div>
      <div class="sug-riga"><span>pioggia</span><b>${pc(d.prob)}</b></div>
      ${d.mm >= 0.05 ? `<div class="sug-riga"><span>quantità</span><b>${g1(d.mm)} mm</b></div>` : ''}
      <div class="sug-riga"><span>cielo</span><b>${testo}</b></div>
      <div class="sug-riga"><span>vento</span><b>${g0(d.vento)} km/h</b></div>
      <div class="sug-riga"><span>accordo</span><b>${d.bagnate.length}/${d.nFamiglie} bagnato</b></div>`;
    sug.classList.add('on');
    const r = svg.getBoundingClientRect(), scala = r.width / W;
    let sx = x(i) * scala + 12;
    if (sx + 210 > r.width) sx = x(i) * scala - 210;
    sug.style.left = Math.max(4, sx) + 'px';
    sug.style.top = '12px';
  };
  svg.addEventListener('pointermove', mostra);
  svg.addEventListener('pointerleave', () => { sug.classList.remove('on'); mirino.style.opacity = '0'; });
}

/* ---------------- sette giorni ---------------- */

function rendiGiorni() {
  const { giorni } = STATO;
  if (!giorni.length) { $('#lista-giorni').innerHTML = '<p class="vuoto">Dati giornalieri non disponibili.</p>'; return; }
  const tutteMin = Math.min(...giorni.map(g => g.tmin)), tutteMax = Math.max(...giorni.map(g => g.tmax));
  const scala = v => ((v - tutteMin) / Math.max(1, tutteMax - tutteMin)) * 100;

  const html = giorni.map((g, idx) => {
    const [ic, testo] = tipoGiorno(g);
    const a = scala(g.tmin), b = scala(g.tmax);
    const finestre = g.finestre.length
      ? g.finestre.map(f => elencoOre(f) + ' (' + pc(f.probMax) + ')').join(', ')
      : 'nessuna finestra di pioggia definita';
    const disaccordo = g.ore.filter(o => o.accordoPioggia < 0.5).length;
    const bagnatiTipici = g.ore.reduce((a2, o) => o.prob > a2.prob ? o : a2, g.ore[0]);
    return `
    <button class="giorno" aria-expanded="false" data-i="${idx}">
      <span class="g-data"><b>${nomeGiorno(g.data, giorni[0].data)}</b><span>${dataBreve(g.data)}</span></span>
      <span class="g-simbolo">${icona(ic, 21)}<span>${testo}</span></span>
      <span class="g-curva">${curvaGiorno(g)}</span>
      <span class="g-barra">
        <span class="traccia"></span>
        <span class="arco" style="left:${a.toFixed(1)}%; width:${Math.max(3, b - a).toFixed(1)}%"></span>
        <span class="et" style="left:${a.toFixed(1)}%; transform:translateX(-50%); color:var(--blu)">${g1(g.tmin)}</span>
        <span class="et" style="left:${b.toFixed(1)}%; transform:translateX(-50%); color:var(--arancio)">${g1(g.tmax)}</span>
      </span>
      <span class="g-pioggia">
        <span class="mini"><i style="width:${Math.round(g.prob * 100)}%"></i></span>
        <span>${pc(g.prob)}${g.mm >= 0.15 ? ' · ' + g1(g.mm) + ' mm' : ''}</span>
      </span>
      <span class="g-fiducia"><span class="chip ${g.fiducia}">fiducia ${g.fiducia}</span></span>
    </button>
    <div class="dettaglio" id="dett-${idx}" hidden>
      <div class="col">
        <div>
          <h4>Quando</h4>
          <p>${finestre}.${g.mm >= 0.15 ? ' Totale atteso ' + g1(g.mm) + ' mm, fino a ' + g1(g.mmAlto) + ' mm nello scenario alto.' : ''}</p>
        </div>
        <div>
          <h4>Chi dice pioggia</h4>
          <div class="elenco-mod">
            ${bagnatiTipici.bagnate.map(f => `<span class="pill bagnato">${nomeFamiglia(f)}</span>`).join('')}
            ${bagnatiTipici.asciutte.map(f => `<span class="pill asciutto">${nomeFamiglia(f)}</span>`).join('')}
          </div>
          <p style="margin-top:7px; font-size:12.5px">Nell'ora più critica (${oraDi(bagnatiTipici.k)}) ${bagnatiTipici.bagnate.length} centri su ${bagnatiTipici.nFamiglie} danno precipitazione.</p>
        </div>
        <div>
          <h4>Quanto fidarsi</h4>
          <p>Dispersione fra i modelli sulla temperatura ${g1(g.incertezza)} gradi. ${disaccordo > 0 ? disaccordo + ' ore su ' + g.ore.length + ' con disaccordo netto sulla pioggia.' : 'Accordo sostanziale sulla pioggia in tutte le ore.'} Anticipo ${Math.round(g.lead / 24 * 10) / 10} giorni.</p>
        </div>
        <div>
          <h4>Altro</h4>
          <p>Raffiche fino a ${g0(g.ventoMax)} km/h. Nuvolosità media ${g0(g.nuvoleMedie)} per cento.${g.capeMax >= 700 ? ' Energia convettiva ' + g0(g.capeMax) + ' J/kg, rischio rovesci a macchia.' : ''}${g.neve > 0.3 ? ' Neve attesa ' + g1(g.neve) + ' cm.' : ''}</p>
        </div>
      </div>
    </div>`;
  }).join('');

  $('#lista-giorni').innerHTML = `<div class="giorni">${html}</div>`;
  $('#lista-giorni').querySelectorAll('.giorno').forEach(b => {
    b.addEventListener('click', () => {
      const d = $('#dett-' + b.dataset.i);
      const aperto = b.getAttribute('aria-expanded') === 'true';
      b.setAttribute('aria-expanded', String(!aperto));
      d.hidden = aperto;
    });
  });
}

/* Una curva minuscola con l andamento della temperatura nella giornata: dice
   in un colpo d occhio se il caldo arriva presto, tardi, o se la giornata e piatta. */
function curvaGiorno(g) {
  const v = g.ore.map(o => o.t);
  if (v.length < 6) return '';
  const W = 56, H = 22, min = Math.min(...v), max = Math.max(...v), campo = Math.max(0.5, max - min);
  const punti = v.map((x, i) => `${(i / (v.length - 1) * (W - 2) + 1).toFixed(1)},${(H - 3 - ((x - min) / campo) * (H - 6)).toFixed(1)}`);
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
    <polyline points="${punti.join(' ')}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" opacity=".75"/>
  </svg>`;
}

function nomeFamiglia(f) {
  const m = MODELLI.find(x => x.fam === f);
  if (!m) return f;
  return m.ente.split(',')[0].replace('Stati Uniti', 'NOAA').replace('Giappone', 'JMA').replace('Paesi Bassi', 'KNMI')
          .replace('Danimarca', 'DMI').replace('Germania', 'DWD').replace('Norvegia', 'MET').replace('Canada', 'ECCC')
          .replace('Cina', 'CMA').replace('DWD ', '').replace('NOAA ', '').trim();
}

/* ---------------- ventaglio dei modelli ---------------- */

function rendiComandiVentaglio() {
  const c = $('#comandi-ventaglio');
  c.innerHTML = `<span class="etich">mostra</span>
    <button class="pulsante" data-v="temperatura">temperatura</button>
    <button class="pulsante" data-v="pioggia">pioggia</button>
    <span class="etich" style="margin-left:10px">finestra</span>
    <button class="pulsante" data-f="48">48 ore</button>
    <button class="pulsante" data-f="168">7 giorni</button>`;
  const aggiorna = () => {
    c.querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === STATO.ventaglio.variabile)));
    c.querySelectorAll('[data-f]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.f === STATO.ventaglio.finestra)));
  };
  c.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.v) STATO.ventaglio.variabile = b.dataset.v;
    if (b.dataset.f) STATO.ventaglio.finestra = +b.dataset.f;
    aggiorna(); disegnaVentaglio();
  });
  aggiorna();
}

function disegnaVentaglio() {
  const box = $('#tela-ventaglio');
  const W = Math.max(300, Math.floor(box.clientWidth) - 16);
  const stretto = W < 560;
  const { variabile, finestra } = STATO.ventaglio;
  const dati = STATO.consenso.slice(0, Math.min(STATO.consenso.length, finestra));
  if (!dati.length) return;
  const n = dati.length;
  const ML = 34, MR = 8, MT = 14, HG = stretto ? 160 : 210, HX = 22;
  const H = MT + HG + HX;
  const larg = (W - ML - MR) / n;
  const x = i => ML + (i + 0.5) * larg;

  const serieMod = [];
  for (const id of Object.keys(STATO.det.serie)) {
    const s = STATO.det.serie[id];
    const col = variabile === 'temperatura' ? s.temperature_2m : s.precipitation;
    if (!col) continue;
    const punti = dati.map(d => col.has(d.k) ? col.get(d.k) : null);
    if (punti.filter(p => p !== null).length < n * 0.55) continue;
    if (variabile === 'pioggia') {
      let acc = 0;
      serieMod.push({ id, punti: punti.map(p => (acc += (p || 0))) });
    } else serieMod.push({ id, punti });
  }
  let consensoPunti;
  if (variabile === 'pioggia') { let acc = 0; consensoPunti = dati.map(d => (acc += d.mm)); }
  else consensoPunti = dati.map(d => d.t);

  const tutti = serieMod.flatMap(s => s.punti).filter(v => v !== null).concat(consensoPunti);
  let vMin = Math.min(...tutti), vMax = Math.max(...tutti);
  if (variabile === 'pioggia') vMin = 0;
  const pad = Math.max(variabile === 'pioggia' ? 0.6 : 0.6, (vMax - vMin) * 0.08);
  vMax += pad; if (variabile === 'temperatura') vMin -= pad;
  const y = v => MT + HG - ((v - vMin) / Math.max(0.1, vMax - vMin)) * HG;

  let s = '';
  const passoV = variabile === 'pioggia'
    ? (vMax > 30 ? 10 : vMax > 12 ? 5 : vMax > 5 ? 2 : 1)
    : ((vMax - vMin) > 16 ? 5 : (vMax - vMin) > 8 ? 2 : 1);
  for (let v = Math.ceil(vMin / passoV) * passoV; v <= vMax; v += passoV) {
    s += `<line class="gx-lieve" x1="${ML}" y1="${y(v).toFixed(1)}" x2="${W - MR}" y2="${y(v).toFixed(1)}"/>`;
    s += `<text class="et-asse" x="${ML - 6}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${v}</text>`;
  }
  s += `<text class="et-asse" x="${ML - 6}" y="${MT - 3}" text-anchor="end">${variabile === 'pioggia' ? 'mm' : '°C'}</text>`;

  dati.forEach((d, i) => {
    const h = +d.k.slice(11, 13);
    if (h === 0 && i > 0) {
      const px = (ML + i * larg).toFixed(1);
      s += `<line class="gx" x1="${px}" y1="${MT}" x2="${px}" y2="${MT + HG}"/>`;
      if (larg * 24 > 42) s += `<text class="et-giorno" x="${(+px + 4).toFixed(1)}" y="${H - 6}">${nomeGiorno(d.k.slice(0, 10), dati[0].k.slice(0, 10)).slice(0, 3)}</text>`;
    }
    if (finestra <= 48 && h % (stretto ? 6 : 3) === 0) s += `<text class="et-asse" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${String(h).padStart(2, '0')}</text>`;
  });

  for (const sm of serieMod) {
    const pts = sm.punti.map((v, i) => v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`).filter(Boolean);
    s += `<polyline class="traccia-mod" data-id="${sm.id}" points="${pts.join(' ')}"/>`;
  }
  s += `<polyline class="linea-cons" points="${consensoPunti.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>`;
  s += `<rect x="${ML}" y="${MT}" width="${W - ML - MR}" height="${HG}" fill="transparent" style="cursor:crosshair"/>`;
  s += `<line id="mirino-v" class="mirino" x1="0" y1="${MT}" x2="0" y2="${MT + HG}" style="opacity:0"/>`;

  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Confronto fra i singoli modelli">${s}</svg>
    <div class="suggerimento" id="sug-v"></div>`;

  const svg = box.querySelector('svg'), sug = $('#sug-v'), mirino = $('#mirino-v');
  svg.addEventListener('pointermove', ev => {
    const r = svg.getBoundingClientRect();
    const px = (ev.clientX - r.left) * (W / r.width);
    const py = (ev.clientY - r.top) * (W / r.width);
    const i = chiudi(Math.floor((px - ML) / larg), 0, n - 1);
    const valori = serieMod.map(sm => ({ id: sm.id, v: sm.punti[i] })).filter(o => o.v !== null);
    if (!valori.length) return;
    let vicino = valori[0], dist = Infinity;
    for (const o of valori) { const d2 = Math.abs(y(o.v) - py); if (d2 < dist) { dist = d2; vicino = o; } }
    svg.querySelectorAll('.traccia-mod').forEach(p => p.classList.toggle('evid', p.dataset.id === vicino.id && dist < 9));
    mirino.setAttribute('x1', x(i)); mirino.setAttribute('x2', x(i)); mirino.style.opacity = '1';
    const vals = valori.map(o => o.v).sort((a, b) => a - b);
    const um = variabile === 'pioggia' ? ' mm' : ' °C';
    const m = PER_ID[vicino.id];
    sug.innerHTML = `<h4>${nomeGiorno(dati[i].k.slice(0, 10), dati[0].k.slice(0, 10))} ${oraDi(dati[i].k)}</h4>
      <div class="sug-riga"><span>consenso</span><b>${g1(consensoPunti[i])}${um}</b></div>
      <div class="sug-riga"><span>più basso</span><b>${g1(vals[0])}${um}</b></div>
      <div class="sug-riga"><span>più alto</span><b>${g1(vals[vals.length - 1])}${um}</b></div>
      <div class="sug-riga"><span>modelli</span><b>${vals.length}</b></div>
      ${dist < 9 && m ? `<div class="sug-riga" style="margin-top:5px; border-top:1px solid var(--line); padding-top:5px"><span>${m.nome}, ${m.ente}</span><b>${g1(vicino.v)}${um}</b></div>` : ''}`;
    sug.classList.add('on');
    const scala = r.width / W;
    let sx = x(i) * scala + 12;
    if (sx + 215 > r.width) sx = x(i) * scala - 215;
    sug.style.left = Math.max(4, sx) + 'px';
    sug.style.top = '10px';
  });
  svg.addEventListener('pointerleave', () => {
    sug.classList.remove('on'); mirino.style.opacity = '0';
    svg.querySelectorAll('.traccia-mod').forEach(p => p.classList.remove('evid'));
  });
}

/* ---------------- pagella ---------------- */

function rendiPagella() {
  const { pagella } = STATO;
  const righe = MODELLI.filter(m => pagella[m.id]).map(m => {
    const v = pagella[m.id];
    return {
      m, v,
      mae24: v.per[24] ? v.per[24].mae : null,
      mae48: v.per[48] ? v.per[48].mae : null,
      mae72: v.per[72] ? v.per[72].mae : null,
      pod: v.per[24] ? v.per[24].pod : null,
      far: v.per[24] ? v.per[24].far : null,
      sMax: v.estremi ? v.estremi.max.scarto : null,
      sfas: STATO.sfasamenti && STATO.sfasamenti[m.id] ? STATO.sfasamenti[m.id].ore : 0
    };
  }).sort((a, b) => (a.mae24 === null ? 99 : a.mae24) - (b.mae24 === null ? 99 : b.mae24));

  if (!righe.length) {
    $('#tabella-pagella').innerHTML = '<p class="vuoto">Verifica non disponibile: le misure delle stazioni o le previsioni passate non sono arrivate.</p>';
    return;
  }
  const corpo = righe.map((r, i) => `
    <tr>
      <td><span class="rank">${i + 1}</span><b>${r.m.nome}</b><span class="ente">${r.m.ente} · ${r.m.ris}</span></td>
      <td class="v">${r.mae24 === null ? '-' : g1(r.mae24) + ' °C'}</td>
      <td class="v">${r.mae48 === null ? '-' : g1(r.mae48) + ' °C'}</td>
      <td class="v">${r.mae72 === null ? '-' : g1(r.mae72) + ' °C'}</td>
      <td class="v" style="${r.sMax !== null && Math.abs(r.sMax) > 1 ? 'color:var(--allerta)' : ''}">${r.sMax === null ? '-' : (r.sMax > 0 ? '+' : '') + g1(r.sMax)}</td>
      <td class="v">${r.pod === null ? '-' : pc(r.pod)}</td>
      <td class="v">${r.far === null ? '-' : pc(r.far)}</td>
      <td class="v">${r.sfas === 0 ? 'nessuno' : (r.sfas > 0 ? '+' : '') + r.sfas + ' h'}</td>
    </tr>`).join('');

  $('#tabella-pagella').innerHTML = `<div class="scorri"><table>
    <thead><tr>
      <th>Modello</th><th>Errore 24 h</th><th>Errore 48 h</th><th>Errore 72 h</th>
      <th>Scarto sulla massima</th><th>Pioggia vista</th><th>Falsi allarmi</th><th>Sfasamento pioggia</th>
    </tr></thead><tbody>${corpo}</tbody></table></div>
    <p class="guida" style="margin-top:12px; margin-bottom:0">Errore: scarto medio assoluto sulla temperatura oraria rispetto alle stazioni, per previsioni emesse 24, 48 e 72 ore prima. Scarto sulla massima: di quanto il modello manca il picco del giorno dopo che la correzione oraria ha già fatto il suo lavoro, ed è il numero che viene sottratto alle massime previste. Pioggia vista: quante volte aveva annunciato la pioggia poi caduta. Falsi allarmi: quante volte ha annunciato pioggia che non è arrivata. Sfasamento: di quante ore la sua pioggia arriva in anticipo o in ritardo, corretto quando il guadagno supera l'otto per cento.</p>`;

  rendiImparato(righe);
}

function rendiImparato(righe) {
  const note = [];
  const migliore = righe[0], peggiore = righe[righe.length - 1];
  if (migliore && migliore.mae24 !== null) {
    note.push({ cls: '', t: 'chi comanda adesso',
      d: `Su Pedrengo, negli ultimi giorni, ${migliore.m.nome} di ${migliore.m.ente} è il più preciso sulla temperatura a 24 ore: ${g1(migliore.mae24)} gradi di errore medio contro ${g1(peggiore.mae24)} del meno preciso. Questo però non gli dà più voce in capitolo, e il motivo è nel riquadro qui accanto.` });
  }

  note.push({ cls: 'att', t: 'una cosa che non ha funzionato',
    d: `Dare più peso ai modelli più bravi sembrava ovvio, ed è stato provato: su 21 giorni mai visti prima peggiorava il risultato, da 0,97 gradi con tutti i centri uguali a 0,98 con la pesatura piena, in modo regolare a ogni dose intermedia. Le stime di bravura sono troppo rumorose per aggiungere informazione, e la mediana è già robusta da sola. Quindi ogni centro conta uguale. Verrà rimisurato quando l'archivio sarà più lungo.` });

  const conMax = righe.filter(r => r.sMax !== null);
  if (conMax.length >= 5) {
    const m = media(conMax.map(r => r.sMax));
    note.push({ cls: 'corr', t: 'il picco del pomeriggio',
      d: `Anche dopo la correzione oraria i modelli mancano la massima del giorno di ${g1(Math.abs(m))} gradi ${m < 0 ? 'in difetto' : 'in eccesso'}. Parte è matematica: il massimo di una media è più basso della media dei massimi. Ora la massima si calcola prendendo il picco di ogni modello e togliendo il suo scarto misurato, e sui giorni di prova l'errore è passato da 1,44 a 0,68 gradi.` });
  }

  if (STATO.fascia && STATO.fascia.stimato) {
    const f = STATO.fascia;
    note.push({ cls: 'corr', t: 'la fascia diceva bugie',
      d: `La dispersione fra i modelli è più stretta dell'errore vero: la fascia grezza conteneva il valore misurato solo nel ${pc(f.coperturaPrima)} dei casi invece dell'80 per cento promesso. Viene quindi allargata di ${g1(f.fattore)} volte, e così la copertura sale al ${pc(f.coperturaDopo)} su ${f.nProva} ore di controllo. Preferisco una fascia larga e onesta a una stretta che mente.` });
  }

  if (STATO.zona) {
    const z = STATO.zona;
    note.push({ cls: '', t: 'piove in zona, non per forza qui',
      d: `Su ${z.oreDiPioggiaInZona} ore in cui almeno un pluviometro della zona ha registrato pioggia, a Pedrengo ne è arrivata nel ${pc(z.quotaCheArrivaQui)} dei casi${z.rapportoQuantita !== null ? `, e in quantità pari al ${pc(z.rapportoQuantita)} di quella caduta nel punto più bagnato` : ''}. I modelli prevedono la media su celle larghe chilometri, e questa è la differenza fra quella media e il paese.` });
  }

  const conSfas = righe.filter(r => r.sfas !== 0);
  if (conSfas.length) {
    const avanti = conSfas.filter(r => r.sfas < 0).length, indietro = conSfas.filter(r => r.sfas > 0).length;
    note.push({ cls: 'corr', t: 'pioggia in anticipo o in ritardo',
      d: `${conSfas.length} modelli su ${righe.length} sbagliano l'orario della pioggia in modo abbastanza costante da poterlo correggere: ${avanti} la portano in anticipo, ${indietro} in ritardo. La loro pioggia viene letta spostata delle ore misurate, invece che presa com'è.` });
  }

  // scarto medio per regime, calcolato sui modelli
  const perRegime = {};
  for (const r of righe) {
    for (const [reg, dati] of Object.entries(r.v.regimi || {})) {
      (perRegime[reg] = perRegime[reg] || []).push({ s: dati.scarto, n: dati.n });
    }
  }
  const nomiRegime = { 'notte-sereno': 'notti serene', 'notte-coperto': 'notti coperte', 'giorno-sereno': 'giornate soleggiate', 'giorno-coperto': 'giornate coperte' };
  let peggioreReg = null;
  for (const [reg, lista] of Object.entries(perRegime)) {
    const s = media(lista.map(x => x.s));
    if (lista.length >= 4 && (peggioreReg === null || Math.abs(s) > Math.abs(peggioreReg.s))) peggioreReg = { reg, s, n: somma(lista.map(x => x.n)) };
  }
  if (peggioreReg && Math.abs(peggioreReg.s) > 0.35) {
    note.push({ cls: 'corr', t: 'errore sistematico trovato',
      d: `Nelle ${nomiRegime[peggioreReg.reg] || peggioreReg.reg} i modelli leggono in media ${peggioreReg.s > 0 ? g1(peggioreReg.s) + ' gradi in più' : g1(-peggioreReg.s) + ' gradi in meno'} rispetto alle stazioni. Questa correzione viene sottratta prima di calcolare il consenso, non dopo.` });
  }

  const far = righe.map(r => r.far).filter(x => x !== null);
  const pod = righe.map(r => r.pod).filter(x => x !== null);
  if (far.length >= 5) {
    note.push({ cls: 'att', t: 'falsi allarmi pioggia',
      d: `In media, quando un modello annuncia pioggia a Pedrengo, nel ${pc(media(far))} dei casi non arriva niente di misurabile. La probabilità mostrata sopra è già abbassata di conseguenza, invece di ripetere l'annuncio.` });
  }
  if (pod.length >= 5) {
    note.push({ cls: '', t: 'pioggia che sfugge',
      d: `I modelli intercettano in media il ${pc(media(pod))} delle ore di pioggia effettivamente misurate. Il restante sfugge quasi sempre perché si tratta di rovesci brevi e locali, che a 2 km di distanza non cadono.` });
  }

  if (STATO.bins) {
    const utili = STATO.bins.filter(b => b.n >= 10);
    if (utili.length >= 3) {
      const alto = utili[utili.length - 1];
      const a = STATO.taraturaArchivio;
      note.push({ cls: 'corr', t: 'taratura della probabilità',
        d: `Quando ${Math.round(alto.c * 100)} per cento dei centri annunciava pioggia, qui è piovuto davvero nel ${pc(alto.colpi / alto.n)} dei casi su ${alto.n} ore verificate. È questa curva, non una tabella fissa, a convertire l'accordo dei modelli in probabilità.${a ? ` Costruita su ${g0(a.giorniGuardati)} giorni e ${g0(a.orePiovoseMisurate)} ore di pioggia misurata, aggiornata ogni notte.` : ''}` });
    }
  }
  if (STATO.offsetSito !== null) {
    note.push({ cls: '', t: 'differenza fra stazione e paese',
      d: `Le stazioni usate come riferimento misurano in media ${g1(Math.abs(STATO.offsetSito))} gradi ${STATO.offsetSito > 0 ? 'in più' : 'in meno'} rispetto al punto di Pedrengo. Lo scarto viene rimosso prima di giudicare i modelli, altrimenti verrebbe scambiato per un loro errore.` });
  }

  $('#imparato').innerHTML = note.map(n => `<div class="nota ${n.cls}"><b>${n.t}</b>${n.d}</div>`).join('');
}

/* ---------------- verifica storica ---------------- */

function rendiVerifica() {
  const righe = STATO.verifica;
  if (!righe.length) {
    $('#tabella-verifica').innerHTML = '<p class="vuoto">Non ci sono ancora giorni completi da verificare.</p>';
    return;
  }
  const corpo = righe.slice().reverse().map(r => {
    const err = r.tmaxPrev - r.tmaxVero;
    const col = Math.abs(err) < 1 ? 'var(--ok)' : Math.abs(err) < 2.2 ? 'var(--attesa)' : 'var(--allerta)';
    const pioggiaOk = (r.mmVero >= 0.5) === (r.mmPrev >= 0.5);
    return `<tr>
      <td><b>${dataBreve(r.data)}</b><span class="ente">${GIORNI_NOME[dataDaChiave(r.data + 'T12').getDay()]}</span></td>
      <td class="v">${g1(r.tmaxPrev)}</td>
      <td class="v">${g1(r.tmaxVero)}</td>
      <td class="v" style="color:${col}">${err > 0 ? '+' : ''}${g1(err)}</td>
      <td class="v">${g1(r.maeCons)}</td>
      <td class="v">${r.migliore ? g1(r.migliore.mae) : '-'}</td>
      <td class="v">${r.totali ? r.battuti + ' su ' + r.totali : '-'}</td>
      <td class="v" style="color:${pioggiaOk ? 'var(--ok)' : 'var(--allerta)'}">${g1(r.mmPrev)} / ${g1(r.mmVero)}</td>
    </tr>`;
  }).join('');

  const maeMedio = media(righe.map(r => r.maeCons));
  const migliori = righe.map(r => r.migliore ? r.migliore.mae : null).filter(x => x !== null);
  const mediani = righe.map(r => r.mediano ? r.mediano.mae : null).filter(x => x !== null);
  const battuti = somma(righe.map(r => r.battuti)), totali = somma(righe.map(r => r.totali));

  $('#tabella-verifica').innerHTML = `<div class="scorri"><table>
    <thead><tr>
      <th>Giorno</th><th>Massima prevista</th><th>Massima vera</th><th>Scarto</th>
      <th>Errore consenso</th><th>Errore miglior modello</th><th>Modelli battuti</th><th>Pioggia prev. / vera</th>
    </tr></thead><tbody>${corpo}</tbody></table></div>
    <div class="imparato" style="margin-top:14px">
      <div class="nota"><b>Il conto</b>Su ${righe.length} giorni verificati, il consenso ha sbagliato in media <b style="display:inline; font-family:var(--mono); text-transform:none; letter-spacing:0; color:var(--ink); font-size:inherit">${g1(maeMedio)} gradi</b> sulla temperatura oraria, contro ${g1(media(mediani))} del modello singolo mediano e ${g1(media(migliori))} del migliore scelto con il senno di poi.</div>
      <div class="nota ${battuti / Math.max(1, totali) > 0.6 ? '' : 'att'}"><b>Ha senso incrociare?</b>Il consenso è stato più preciso di ${battuti} confronti su ${totali} con i singoli modelli, cioè nel ${pc(battuti / Math.max(1, totali))} dei casi. ${battuti / Math.max(1, totali) > 0.6 ? 'Incrociare i modelli sta pagando.' : 'In questi giorni il vantaggio è stato modesto, capita quando la situazione è stabile e tutti i modelli vanno bene.'}</div>
      <div class="nota att"><b>Nota onesta</b>Questa ricostruzione usa le previsioni emesse un giorno prima, a pesi uguali fra centri, per evitare di giudicarsi con i pesi ricavati dagli stessi dati. È il confronto più severo possibile con le informazioni disponibili.</div>
    </div>
    ${rendiArchivio()}`;
}

/* Il registro delle previsioni davvero emesse da questo sito, messo da parte
   ogni notte e verificato quando il giorno si chiude. E piu severo della
   ricostruzione qui sopra, perche non puo essere rifatto col senno di poi. */
function rendiArchivio() {
  const a = STATO.archivioVerifiche;
  const righe = a && Array.isArray(a.righe) ? a.righe : [];
  const riassunto = (a && a.riassunto) || {};
  const leads = Object.keys(riassunto).sort((x, y) => +x - +y);

  if (!righe.length) {
    return `<div class="nota att" style="margin-top:14px"><b>Registro delle previsioni emesse</b>
      L'archivio è appena partito: ogni notte viene messa da parte la previsione che il sito ha davvero emesso, e viene verificata quando il giorno si chiude. Le prime righe compariranno domani, e da lì in poi il registro cresce da solo senza potersi correggere a posteriori.</div>`;
  }
  const corpo = leads.map(l => {
    const r = riassunto[l];
    return `<tr>
      <td><b>${l} ${+l === 1 ? 'giorno' : 'giorni'}</b><span class="ente">di anticipo</span></td>
      <td class="v">${r.giorni}</td>
      <td class="v">${g1(r.erroreMassima)} °C</td>
      <td class="v">${r.scartoMassima > 0 ? '+' : ''}${g1(r.scartoMassima)} °C</td>
      <td class="v">${r.brierPioggia === null ? '-' : g1(r.brierPioggia * 100) + ' su 100'}</td>
    </tr>`;
  }).join('');

  return `<h3 style="margin:26px 0 6px; font-size:16px">Registro delle previsioni emesse</h3>
    <p class="guida">Questa tabella non è una ricostruzione: è quello che il sito ha scritto in home page quel giorno, salvato prima di sapere come sarebbe andata. Su ${righe.length} previsioni verificate.</p>
    <div class="scorri"><table>
      <thead><tr><th>Anticipo</th><th>Giorni verificati</th><th>Errore sulla massima</th><th>Scarto medio</th><th>Punteggio pioggia</th></tr></thead>
      <tbody>${corpo}</tbody></table></div>
    <p class="guida" style="margin-top:10px; margin-bottom:0">Scarto medio: se è negativo il sito tende a sottostimare, se è positivo a sovrastimare. Punteggio pioggia: quanto si discostano le probabilità annunciate da quello che è successo, zero sarebbe la perfezione e venticinque il valore di chi tira a indovinare dicendo sempre metà e metà.</p>`;
}

/* ---------------- memoria di lungo periodo ---------------- */

async function apriMemoria() {
  try {
    const db = await (window.claude && window.claude.use ? window.claude.use('db') : null);
    if (!db) return null;
    return db;
  } catch (e) { return null; }
}

async function leggiMemoria(db) {
  const out = { taratura: null, storico: [] };
  try {
    const t = await db.doc('memoria/taratura').get();
    if (t.exists) out.taratura = t.data();
  } catch (e) { }
  try {
    const q = await db.collection('verifiche').orderBy('data', 'desc').limit(120).get();
    out.storico = q.docs.map(d => d.data()).filter(Boolean);
  } catch (e) { }
  return out;
}

async function scriviMemoria(db) {
  const oggi = chiaveOra(new Date()).slice(0, 10);
  try {
    const lucchetto = await db.doc('memoria/lucchetto').acquire({ holder: 'sessione-' + Math.random().toString(36).slice(2, 8), ttlMs: 20000 });
    if (!lucchetto.acquired) return;
  } catch (e) { return; }

  // bins della taratura, sommati a quelli già in memoria
  try {
    const rif = db.doc('memoria/taratura');
    const attuale = await rif.get();
    const vecchi = attuale.exists && Array.isArray(attuale.data().bins) ? attuale.data().bins : null;
    const fusi = (STATO.bins || []).map((b, i) => {
      const v = vecchi && vecchi[i] ? vecchi[i] : { n: 0, colpi: 0 };
      const ultimo = attuale.exists ? attuale.data().ultimo : null;
      if (ultimo === oggi) return v;
      return { c: b.c, n: (v.n || 0) + b.n, colpi: (v.colpi || 0) + b.colpi };
    });
    await rif.set({ bins: fusi, ultimo: oggi, aggiornato: new Date().toISOString() });
  } catch (e) { }

  // una riga di verifica per ogni giorno chiuso
  try {
    for (const r of STATO.verifica.slice(-4)) {
      if (r.data >= oggi) continue;
      const rif = db.collection('verifiche').doc(r.data);
      const esiste = await rif.get();
      if (esiste.exists) continue;
      await rif.set({
        data: r.data, tmaxPrev: r.tmaxPrev, tmaxVero: r.tmaxVero, tminPrev: r.tminPrev, tminVero: r.tminVero,
        maeCons: r.maeCons, maeMigliore: r.migliore ? r.migliore.mae : null,
        battuti: r.battuti, totali: r.totali, mmPrev: r.mmPrev, mmVero: r.mmVero,
        scritto: new Date().toISOString()
      });
    }
  } catch (e) { }
}

function fondiTaratura(memoria) {
  if (!memoria || !memoria.taratura || !Array.isArray(memoria.taratura.bins)) return;
  STATO.bins = STATO.bins.map((b, i) => {
    const v = memoria.taratura.bins[i];
    if (!v) return b;
    return { c: b.c, n: b.n + (v.n || 0), colpi: b.colpi + (v.colpi || 0) };
  });
}

function aggiungiStorico(memoria) {
  if (!memoria || !memoria.storico.length) return;
  const presenti = new Set(STATO.verifica.map(r => r.data));
  const extra = memoria.storico
    .filter(r => r && r.data && !presenti.has(r.data))
    .map(r => ({ ...r, migliore: r.maeMigliore !== null && r.maeMigliore !== undefined ? { mae: r.maeMigliore } : null,
                 mediano: null, peggiore: null }))
    .sort((a, b) => a.data < b.data ? -1 : 1);
  STATO.verifica = extra.concat(STATO.verifica);
}

/* ---------------- avvio ---------------- */

async function avvia() {
  const t0 = performance.now();
  stato('scarico i modelli', '');
  passo(0);

  const idModelli = MODELLI.map(m => m.id).join(',');
  const orizzonteVerifica = new Date(Date.now() - GIORNI_VERIFICA * 86400e3).toISOString().slice(0, 19);
  const recente = new Date(Date.now() - 12 * 3600e3).toISOString().slice(0, 19);

  const richieste = [
    scaricaConRitento(urlOpenMeteo('https://api.open-meteo.com/v1/forecast', {
      hourly: VARIABILI.join(','), models: idModelli, forecast_days: 7, past_days: 2
    }), 45000),
    scaricaConRitento(urlOpenMeteo('https://ensemble-api.open-meteo.com/v1/ensemble', {
      hourly: 'temperature_2m,precipitation', models: 'ecmwf_ifs025,icon_eu,gfs025', forecast_days: 7
    }), 45000),
    scaricaConRitento(urlOpenMeteo('https://previous-runs-api.open-meteo.com/v1/forecast', {
      hourly: ['temperature_2m', 'temperature_2m_previous_day1', 'temperature_2m_previous_day2', 'temperature_2m_previous_day3',
               'precipitation', 'precipitation_previous_day1', 'precipitation_previous_day2', 'precipitation_previous_day3'].join(','),
      models: idModelli, past_days: GIORNI_VERIFICA, forecast_days: 1
    }), 60000),
    scaricaConRitento(urlArpa(['8145', '19022', '5864', '8161', '19026', '5857', '22322'], orizzonteVerifica, 30000), 45000),
    scaricaConRitento(urlArpa(['6158', '19103', '5981'], recente, 500), 25000),
    scarica(urlOpenMeteo('https://api.open-meteo.com/v1/forecast', {
      hourly: 'cape', models: 'icon_seamless,ecmwf_ifs025,gfs_seamless,italia_meteo_arpae_icon_2i', forecast_days: 7
    }), 30000).catch(() => null),
    // l archivio sta accanto alla pagina: lo riempie ogni notte il lavoro programmato
    scarica(urlOpenMeteo('https://api.open-meteo.com/v1/forecast', {
      daily: 'sunrise,sunset', forecast_days: 8, past_days: 1
    }), 20000).catch(() => null),
    scarica('dati/taratura.json', 10000).catch(() => null),
    scarica('dati/verifiche.json', 10000).catch(() => null)
  ];

  const esiti = await Promise.allSettled(richieste);
  const val = i => esiti[i].status === 'fulfilled' ? esiti[i].value : null;
  STATO.tempi.rete = Math.round(performance.now() - t0);
  passo(2);

  const rDet = val(0);
  if (!rDet) {
    stato('nessun dato raggiunto', 'rotto');
    const motivo = esiti[0].reason;
    const bloccato = motivo && /Failed to fetch|NetworkError|blocked|CSP/i.test(String(motivo.message || motivo));
    $('#blocco-adesso').innerHTML = `<div class="riquadro" style="grid-column:1 / -1">
      <div class="errore">
        <b style="display:block; margin-bottom:6px">Nessun dato scaricato: ${bloccato ? 'le richieste di rete sono state bloccate' : 'i server non hanno risposto'}.</b>
        ${bloccato
          ? 'La pagina sta girando in un contesto che vieta le chiamate verso api.open-meteo.com e dati.lombardia.it. Succede dentro le anteprime in sandbox. Aprila da un server web normale, anche solo in locale, e i dati arrivano.'
          : 'Controlla la connessione e ricarica. Se il problema resta, i servizi Open-Meteo o ARPA Lombardia potrebbero essere momentaneamente fermi.'}
        <span style="display:block; margin-top:8px; font-family:var(--mono); font-size:11.5px; opacity:.8">dettaglio tecnico: ${String(motivo && motivo.message ? motivo.message : motivo || 'sconosciuto').slice(0, 120)}</span>
      </div></div>`;
    for (const sel of ['#tela-ore', '#tela-ventaglio', '#lista-giorni', '#tabella-pagella', '#tabella-verifica']) {
      const e = $(sel); if (e) e.innerHTML = '<p class="vuoto">In attesa dei dati.</p>';
    }
    $('#bollettino').innerHTML = '<p class="vuoto">Senza dati non viene scritto nessun bollettino. Meglio niente che una previsione inventata.</p>';
    return;
  }
  stato('incrocio i dati', '');

  const det = leggiMultiModello(rDet, MODELLI.map(m => m.id), VARIABILI);
  const ens = val(1) ? leggiEnsemble(val(1)) : { ore: [], sistemi: {} };
  const prev = val(2) ? leggiMultiModello(val(2), MODELLI.map(m => m.id),
    ['temperature_2m', 'temperature_2m_previous_day1', 'temperature_2m_previous_day2', 'temperature_2m_previous_day3',
     'precipitation', 'precipitation_previous_day1', 'precipitation_previous_day2', 'precipitation_previous_day3']) : { ore: [], serie: {} };

  const righeArpa = (val(3) || []).concat(val(4) || []);
  const perSensore = aggregaArpa(righeArpa);
  let oss = serieOsservate(perSensore);

  // ultimi valori grezzi per il pannello di adesso
  const ultimi = {};
  for (const r of righeArpa) {
    const v = parseFloat(r.valore);
    if (!isFinite(v) || v <= -900) continue;
    if (!ultimi[r.idsensore] || r.data > ultimi[r.idsensore].raw) {
      const d = new Date(r.data.length > 19 ? r.data + 'Z' : r.data + '.000Z');
      ultimi[r.idsensore] = { v, raw: r.data, ora: new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(d) };
    }
  }
  STATO.ultimi = ultimi;

  // analisi multimodello per le ore passate, serve per allineamento e correzione di sito.
  // i run precedenti coprono sette giorni indietro, la previsione corrente solo due
  const analisi = new Map();
  const accumula = (fonte) => {
    const per = new Map();
    for (const id of Object.keys(fonte.serie)) {
      const t = fonte.serie[id].temperature_2m;
      if (!t) continue;
      t.forEach((v, k) => { if (!per.has(k)) per.set(k, []); per.get(k).push(v); });
    }
    per.forEach((v, k) => { if (v.length >= 5 && !analisi.has(k)) analisi.set(k, media(v)); });
  };
  accumula(det);
  accumula(prev);

  const all = controllaAllineamento(oss.temp, analisi);
  if (all.scarto) {
    oss = { ...oss, temp: spostaSerie(oss.temp, all.scarto), pioggia: spostaSerie(oss.pioggia, all.scarto) };
  }

  // scarto sistematico fra stazioni e punto griglia di Pedrengo
  const diffSito = [];
  oss.temp.forEach((v, k) => { const a = analisi.get(k); if (a !== undefined) diffSito.push(v - a); });
  if (diffSito.length >= 48) {
    diffSito.sort((a, b) => a - b);
    STATO.offsetSito = diffSito[Math.floor(diffSito.length / 2)];
    const corretta = new Map();
    oss.temp.forEach((v, k) => corretta.set(k, v - STATO.offsetSito));
    oss = { ...oss, temp: corretta, tempStazione: new Map(oss.temp) };
  }

  const nuvoleRif = new Map();
  for (const k of det.ore) {
    const v = [];
    for (const id of Object.keys(det.serie)) {
      const c = det.serie[id].cloud_cover; if (c && c.has(k)) v.push(c.get(k));
    }
    if (v.length) nuvoleRif.set(k, media(v));
  }

  STATO.pagella = calcolaPagella(prev, oss, nuvoleRif);
  STATO.bins = curvaAffidabilita(prev, oss);

  /* L archivio guarda indietro novantadue giorni invece di ventuno, e per la
     pioggia la differenza e enorme: in tre settimane ci sono sei o sette ore
     piovose, in tre mesi una ottantina. Se c e, la sua taratura vince. */
  const archivio = val(7);
  if (archivio && Array.isArray(archivio.bins)) {
    const suoi = somma(archivio.bins.map(b => b.n || 0));
    const miei = somma(STATO.bins.map(b => b.n || 0));
    if (suoi > miei) {
      STATO.bins = archivio.bins.map(b => ({ c: b.c, n: b.n || 0, colpi: b.colpi || 0 }));
      STATO.taraturaArchivio = archivio;
    }
  }
  STATO.archivioVerifiche = val(8);
  STATO.verifica = verificaStorica(prev, oss);
  STATO.fascia = taraturaFascia(ricostruisciPassato(prev, oss, nuvoleRif, STATO.pagella));
  STATO.sfasamenti = sfasamentoPioggia(prev, oss);
  STATO.zona = disomogeneitaPioggia(oss);
  passo(3);

  const memoria = await (async () => { const db = await apriMemoria(); return db ? { db, dati: await leggiMemoria(db) } : null; })();
  if (memoria) { fondiTaratura(memoria.dati); aggiungiStorico(memoria.dati); }

  const cape = new Map();
  const rCape = val(5);
  if (rCape && rCape.hourly) {
    const h = rCape.hourly;
    const colonne = Object.keys(h).filter(k => k.startsWith('cape'));
    h.time.forEach((t, i) => {
      const v = colonne.map(c => num(h[c][i])).filter(x => x !== null);
      if (v.length) cape.set(t.slice(0, 13), Math.max(...v));
    });
  }

  const sole = {};
  const rSole = val(6);
  if (rSole && rSole.daily && rSole.daily.time) {
    rSole.daily.time.forEach((g, i) => {
      const alba = rSole.daily.sunrise[i], tram = rSole.daily.sunset[i];
      if (!alba || !tram) return;
      sole[g] = {
        alba: +alba.slice(11, 13) + (+alba.slice(14, 16)) / 60,
        tramonto: +tram.slice(11, 13) + (+tram.slice(14, 16)) / 60,
        albaTesto: alba.slice(11, 16), tramontoTesto: tram.slice(11, 16)
      };
    });
  }
  STATO.sole = sole;

  const adesso = chiaveOra(new Date());
  STATO.det = det; STATO.ens = ens; STATO.oss = oss;
  STATO.consenso = costruisciConsenso({
    det, ens, pagella: STATO.pagella, oss, bins: STATO.bins, adesso, cape,
    fascia: STATO.fascia, sfasamenti: STATO.sfasamenti
  });
  STATO.giorni = aggregaGiorni(STATO.consenso, ens, adesso.slice(0, 10), STATO.pagella);
  passo(4);

  // tag di testa
  const nMod = Object.keys(det.serie).length;
  const nFam = new Set(Object.keys(det.serie).map(id => PER_ID[id].fam)).size;
  let nMembri = 0;
  for (const s of Object.values(ens.sistemi || {})) nMembri += s.membri.size;
  $('#tag-modelli').textContent = `${nMod} modelli · ${nFam} centri`;
  $('#tag-membri').textContent = nMembri ? `${nMembri} membri di ensemble` : 'ensemble non disponibile';
  const nVer = somma(Object.values(STATO.pagella).map(v => v.campioni));
  $('#tag-verifica').textContent = nVer ? `${g0(nVer)} confronti con le stazioni` : 'verifica non disponibile';
  $('#metodo-offset').textContent = STATO.offsetSito === null ? 'non stimabile'
    : (STATO.offsetSito > 0 ? '+' : '') + g1(STATO.offsetSito) + ' °C';

  if (STATO.fascia && STATO.fascia.stimato) {
    const f = STATO.fascia;
    $('#metodo-fascia').textContent = `allargata ${g1(f.fattore)} volte, copertura reale ${pc(f.coperturaDopo)}`;
    const guida = $('#guida-ore');
    if (guida) guida.insertAdjacentHTML('beforeend',
      ` Sugli ultimi ${f.nProva} controlli il valore misurato è caduto dentro la fascia nel ${pc(f.coperturaDopo)} dei casi.`);
  } else {
    $('#metodo-fascia').textContent = 'non ancora misurabile';
  }

  const attive = [];
  for (const s of STAZIONI) {
    if (!perSensore[s.id] || !perSensore[s.id].size) continue;
    if (!attive.some(a => a.nome === s.nome)) attive.push(s);
  }
  STATO.stazioniAttive = attive.filter(s => s.tipo === 'temp').length;
  if (attive.length) {
    $('#metodo-stazioni').textContent = attive
      .sort((a, b) => a.km - b.km)
      .map(s => s.nome + ' a ' + g1(s.km) + ' km')
      .join(', ');
  }

  rendiEroe();
  rendiBollettino();
  disegnaOre();
  rendiGiorni();
  rendiComandiVentaglio();
  disegnaVentaglio();
  rendiPagella();
  rendiVerifica();
  passo(5);
  stato('dati aggiornati', 'vivo');
  STATO.tempi.totale = Math.round(performance.now() - t0);
  $('#pie-tempi').textContent = `Scaricati e incrociati ${nMod} modelli, ${nMembri} membri di ensemble e ${g0(righeArpa.length)} letture di stazione in ${(STATO.tempi.totale / 1000).toFixed(1)} secondi.`;

  if (memoria && memoria.db) { scriviMemoria(memoria.db).catch(() => { }); }

  attivaNavigazione();

  // il nowcasting parte dopo il resto: usa il radar e non deve far aspettare la pagina
  avviaNowcast();
  setInterval(avviaNowcast, 600000);

  let attesa;
  window.addEventListener('resize', () => {
    clearTimeout(attesa);
    attesa = setTimeout(() => { disegnaOre(); disegnaVentaglio(); }, 220);
  });
  setInterval(() => { if (STATO.oss) rendiEroe(); }, 300000);
}

avvia().catch(e => {
  stato('errore', 'rotto');
  $('#tela-ore').innerHTML = '<div class="errore">Qualcosa è andato storto nel calcolo: ' + (e && e.message ? e.message : 'errore sconosciuto') + '. Ricarica la pagina.</div>';
  console.error(e);
});


/* La navigazione segue la lettura: si accende la voce della sezione che occupa
   la parte alta della finestra. */
function attivaNavigazione() {
  const voci = [...document.querySelectorAll('.nav a')];
  const sezioni = voci.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if (!sezioni.length) return;
  let inCorso = false;
  const aggiorna = () => {
    inCorso = false;
    const soglia = 140;
    let attiva = 0;
    sezioni.forEach((s, i) => { if (s.getBoundingClientRect().top <= soglia) attiva = i; });
    voci.forEach((a, i) => a.classList.toggle('attiva', i === attiva));
  };
  window.addEventListener('scroll', () => {
    if (inCorso) return;
    inCorso = true;
    requestAnimationFrame(aggiorna);
  }, { passive: true });
  aggiorna();
}
