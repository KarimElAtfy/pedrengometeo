/* Banco di prova del motore sui dati reali del punto configurato in motore.js.
   Non tocca il sito: scarica, calcola e stampa, cosi si vede se una modifica
   ha rotto qualcosa prima di pubblicarla.

   Uso:  cat motore.js prova.js > _prova.js && node _prova.js            */
(async () => {
  console.log('luogo:', SITO.nome, SITO.lat + ',' + SITO.lon, SITO.quota + ' m | ora locale:', chiaveOra(new Date()));
  const idModelli = MODELLI.map(m => m.id).join(',');
  const orizzonte = new Date(Date.now() - GIORNI_VERIFICA * 86400e3).toISOString().slice(0, 19);

  const [rDet, rEns, rPrev, rArpa, rCape] = await Promise.all([
    scarica(urlOpenMeteo('https://api.open-meteo.com/v1/forecast', { hourly: VARIABILI.join(','), models: idModelli, forecast_days: 7, past_days: 2 }), 60000),
    scarica(urlOpenMeteo('https://ensemble-api.open-meteo.com/v1/ensemble', { hourly: 'temperature_2m,precipitation', models: 'ecmwf_ifs025,icon_eu,gfs025', forecast_days: 7 }), 60000),
    scarica(urlOpenMeteo('https://previous-runs-api.open-meteo.com/v1/forecast', {
      hourly: ['temperature_2m','temperature_2m_previous_day1','temperature_2m_previous_day2','temperature_2m_previous_day3',
               'precipitation','precipitation_previous_day1','precipitation_previous_day2','precipitation_previous_day3'].join(','),
      models: idModelli, past_days: GIORNI_VERIFICA, forecast_days: 1 }), 90000),
    scarica(urlArpa([...new Set(STAZIONI.map(s => s.id))], orizzonte, 40000), 90000),
    scarica(urlOpenMeteo('https://api.open-meteo.com/v1/forecast', { hourly: 'cape', models: 'icon_seamless,ecmwf_ifs025,gfs_seamless,italia_meteo_arpae_icon_2i', forecast_days: 7 }), 40000)
  ]);

  const det = leggiMultiModello(rDet, MODELLI.map(m => m.id), VARIABILI);
  const ens = leggiEnsemble(rEns);
  const prev = leggiMultiModello(rPrev, MODELLI.map(m => m.id),
    ['temperature_2m','temperature_2m_previous_day1','temperature_2m_previous_day2','temperature_2m_previous_day3',
     'precipitation','precipitation_previous_day1','precipitation_previous_day2','precipitation_previous_day3']);

  console.log('\n=== INGESTIONE ===');
  console.log('modelli deterministici attivi:', Object.keys(det.serie).length, '/', MODELLI.length);
  const mancanti = MODELLI.filter(m => !det.serie[m.id]).map(m => m.id);
  if (mancanti.length) console.log('assenti:', mancanti.join(', '));
  console.log('ore previste:', det.ore.length, det.ore[0], '->', det.ore[det.ore.length-1]);
  console.log('sistemi ensemble:', Object.entries(ens.sistemi).map(([k,v]) => k+'='+v.membri.size).join(', '));
  console.log('modelli con run precedenti:', Object.keys(prev.serie).length);
  console.log('righe ARPA:', rArpa.length);

  const perSensore = aggregaArpa(rArpa);
  console.log('sensori con dati:', Object.entries(perSensore).map(([k,v]) => k+'='+v.size).join(' '));
  let oss = serieOsservate(perSensore);
  console.log('ore osservate temp:', oss.temp.size, 'pioggia:', oss.pioggia.size);

  const analisi = new Map();
  const accumula = (fonte) => {
    const per = new Map();
    for (const id of Object.keys(fonte.serie)) {
      const t = fonte.serie[id].temperature_2m; if (!t) continue;
      t.forEach((v, k) => { if (!per.has(k)) per.set(k, []); per.get(k).push(v); });
    }
    per.forEach((v, k) => { if (v.length >= 5 && !analisi.has(k)) analisi.set(k, media(v)); });
  };
  accumula(det); accumula(prev);

  const all = controllaAllineamento(oss.temp, analisi);
  console.log('\n=== ALLINEAMENTO ORARIO ===');
  console.log('scarto scelto:', all.scarto, 'ore, MAE residuo', all.mae ? all.mae.toFixed(2) : '-');
  if (all.scarto) oss = { ...oss, temp: spostaSerie(oss.temp, all.scarto), pioggia: spostaSerie(oss.pioggia, all.scarto) };

  const diff = [];
  oss.temp.forEach((v, k) => { const a = analisi.get(k); if (a !== undefined) diff.push(v - a); });
  diff.sort((a,b)=>a-b);
  const offset = diff.length >= 48 ? diff[Math.floor(diff.length/2)] : null;
  console.log('scarto stazione meno punto griglia (mediana su', diff.length, 'ore):', offset === null ? 'n/d' : offset.toFixed(2), 'gradi');
  if (offset !== null) { const c = new Map(); oss.temp.forEach((v,k)=>c.set(k, v-offset)); oss = { ...oss, temp: c }; }

  const nuvole = new Map();
  for (const k of det.ore) {
    const v = []; for (const id of Object.keys(det.serie)) { const c = det.serie[id].cloud_cover; if (c && c.has(k)) v.push(c.get(k)); }
    if (v.length) nuvole.set(k, media(v));
  }

  const pagella = calcolaPagella(prev, oss, nuvole);
  console.log('\n=== PAGELLA (errore medio sulla temperatura, gradi) ===');
  const ord = Object.values(pagella).sort((a,b) => (a.per[24]?.mae ?? 99) - (b.per[24]?.mae ?? 99));
  console.log('modello'.padEnd(26), '24h    48h    72h    n     pioggia vista  falsi allarmi');
  for (const v of ord) {
    const m = PER_ID[v.id];
    const f = (x, d=2) => x === null || x === undefined ? '  -  ' : x.toFixed(d);
    console.log(
      (m.nome + ' / ' + m.ente).slice(0,25).padEnd(26),
      f(v.per[24]?.mae).padEnd(6), f(v.per[48]?.mae).padEnd(6), f(v.per[72]?.mae).padEnd(6),
      String(v.per[24]?.n ?? 0).padEnd(5),
      (v.per[24]?.pod !== null && v.per[24]?.pod !== undefined ? (v.per[24].pod*100).toFixed(0)+'%' : '-').padEnd(14),
      v.per[24]?.far !== null && v.per[24]?.far !== undefined ? (v.per[24].far*100).toFixed(0)+'%' : '-');
  }

  const { pesi } = pesiFamiglia(pagella, 24, Object.keys(det.serie));
  console.log('\npesi per centro a 24 ore:');
  console.log(Object.entries(pesi).sort((a,b)=>b[1]-a[1]).map(([f,p]) => f+' '+(p*100).toFixed(1)+'%').join('  '));
  const tot = Object.values(pesi).reduce((s,x)=>s+x,0);
  console.log('somma pesi:', tot.toFixed(4));

  const bins = curvaAffidabilita(prev, oss);
  console.log('\n=== CURVA DI AFFIDABILITA DELLA PIOGGIA ===');
  console.log('centri d accordo -> frequenza reale di pioggia');
  for (const b of bins) if (b.n > 0) console.log('  ' + (b.c*100).toFixed(0).padStart(3) + '%  n=' + String(b.n).padStart(4) + '  piovuto ' + ((b.colpi/b.n)*100).toFixed(0) + '%');

  const cape = new Map();
  if (rCape && rCape.hourly) {
    const h = rCape.hourly, cols = Object.keys(h).filter(k => k.startsWith('cape'));
    h.time.forEach((t,i) => { const v = cols.map(c => num(h[c][i])).filter(x=>x!==null); if (v.length) cape.set(t.slice(0,13), Math.max(...v)); });
  }

  const adesso = chiaveOra(new Date());
  const consenso = costruisciConsenso({ det, ens, pagella, oss, bins, adesso, cape });
  console.log('\n=== CONSENSO ===');
  console.log('ore prodotte:', consenso.length, 'da', consenso[0]?.k, 'a', consenso[consenso.length-1]?.k);
  console.log('ora      T      p10    p90   pioggia%  mm    alto   centri bagnati  regime');
  for (const c of consenso.slice(0, 14)) {
    console.log(c.k.slice(5), c.t.toFixed(1).padStart(5), c.p10.toFixed(1).padStart(6), c.p90.toFixed(1).padStart(6),
      (c.prob*100).toFixed(0).padStart(8), c.mm.toFixed(2).padStart(7), c.mmAlto.toFixed(1).padStart(6),
      String(c.bagnate.length + '/' + c.nFamiglie).padStart(12), '  ', c.regime);
  }
  const senzaT = consenso.filter(c => c.t === null || !isFinite(c.t)).length;
  const probFuori = consenso.filter(c => c.prob < 0 || c.prob > 1).length;
  const bandaRotta = consenso.filter(c => c.p10 > c.t || c.p90 < c.t).length;
  console.log('controlli: temperature non valide', senzaT, '| probabilita fuori scala', probFuori, '| bande incoerenti', bandaRotta);

  const giorni = aggregaGiorni(consenso, ens, adesso.slice(0,10));
  console.log('\n=== GIORNI ===');
  for (const g of giorni) {
    console.log(g.data, 'min', g.tmin.toFixed(1).padStart(5), 'max', g.tmax.toFixed(1).padStart(5),
      'pioggia', (g.prob*100).toFixed(0).padStart(3)+'%', 'mm', g.mm.toFixed(1).padStart(5),
      'alto', g.mmAlto.toFixed(1).padStart(5), 'fiducia', g.fiducia.padEnd(6),
      'dispersione', g.incertezza.toFixed(1), 'finestre', g.finestre.length, g.parziale ? '(parziale)' : '');
  }

  const ver = verificaStorica(prev, oss);
  console.log('\n=== VERIFICA STORICA (consenso a 24 ore contro le stazioni) ===');
  console.log('giorno      max prev  max vero  scarto   MAE cons  MAE migliore  MAE mediano  battuti  mm prev/vero');
  for (const r of ver) {
    console.log(r.data, r.tmaxPrev.toFixed(1).padStart(8), r.tmaxVero.toFixed(1).padStart(9),
      (r.tmaxPrev-r.tmaxVero).toFixed(1).padStart(8), r.maeCons.toFixed(2).padStart(9),
      (r.migliore ? r.migliore.mae.toFixed(2) : '-').padStart(13), (r.mediano ? r.mediano.mae.toFixed(2) : '-').padStart(12),
      String(r.battuti+'/'+r.totali).padStart(8), (r.mmPrev.toFixed(1)+'/'+r.mmVero.toFixed(1)).padStart(13));
  }
  if (ver.length) {
    const maeC = media(ver.map(r=>r.maeCons));
    const maeM = media(ver.map(r=>r.mediano?.mae).filter(Boolean));
    const maeB = media(ver.map(r=>r.migliore?.mae).filter(Boolean));
    const b = somma(ver.map(r=>r.battuti)), t2 = somma(ver.map(r=>r.totali));
    console.log('\nRISULTATO: consenso', maeC.toFixed(2), 'gradi | modello mediano', maeM.toFixed(2),
      '| miglior modello col senno di poi', maeB.toFixed(2), '| battuti', b, 'su', t2, '=', ((b/t2)*100).toFixed(0)+'%');
  }
})().catch(e => { console.error('ERRORE:', e); process.exit(1); });
