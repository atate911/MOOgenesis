// The check every piece of the game's score passes before it is called done (the symphonic rewrite, tools/concert/README.md):
//   node tools/concert/piece.js galaxy14 [--port 8820] [--no-render]
//   - the score: its form and timings, notes the engine had to move onto a chord (0 is the aim), the lint's warnings, the melody's
//     strong beats on the chord, how often nothing moves (the texture: the share of 2 s windows where no line moves)
//   - one full performance (its opening and one pass of its loop) through the game's own master: loudness, peak, the limiter, the band
//     balance (and the 200-500 Hz build-up), harsh bursts (energy above 2.5 kHz jumping over its surroundings), the low end's centre
//   Writes tools/concert/out/pieces/<id>.mp3 to listen to. The balance by section: tools/concert/mixreport.js --track <id>; an orchestral
//   piece's acceptance: tools/qa/orchestral.js <id>.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { serve, open } = require('../qa/lib');
const args = process.argv.slice(2), opt = {}; const ids = [];
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true; else ids.push(args[i]); }
const OUT = path.join(__dirname, 'out', 'pieces'), SR = 48000, PORT = +opt.port || 8820;
(async () => {
  const srv = await serve(PORT), { browser, page } = await open();
  await page.goto(`http://localhost:${PORT}/tools/test-audio.html`);
  await page.addScriptTag({ url: `http://localhost:${PORT}/tools/lib/audio-metrics.js` });
  await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music && window.AudioMetrics);
  if (!opt['no-render']) await page.evaluate(async () => { await MOO.Audio.Samples.preload(); });
  fs.mkdirSync(OUT, { recursive: true });
  for (const id of ids.length ? ids : ['title']) {
    const s = await page.evaluate(([id]) => {
      const M = MOO.Audio.Music, d = M._tracks[id]; if (!d) return { err: 'no such piece' };
      if (d.forms && d.forms.length > 1) { d.forms = [d.forms[0]]; d._p = null; }   // its first form (the render and the numbers agree)
      const a = M.analyze(id), c0 = M._compile(id, 0), c1 = M._compile(id, 1);
      // the texture: share of 2 s windows of the first pass in which no line, bass or figure starts a note
      const W = 2, n = Math.ceil(c0.len / W), mv = new Array(n).fill(0);
      for (const e of c0.events) if (e.m && /^(lead|bell|bass|arp)/.test(e.k || e.ly)) mv[Math.min(n - 1, Math.floor(e.t / W))]++;
      return { desc: d.desc, sym: !!d._sym, orch: !!d.orch, form: c0.wraps.map(w => w.R.n + '@' + w.t0.toFixed(0)).join(' '), first: c0.len, loop: c1.len, snaps: c0.snapLog || [],
        warn: a.warnings, strong: a.lead.strongCT, still: mv.filter(x => !x).length / n };
    }, [id]);
    if (s.err) { console.log(`${id}: ${s.err}`); continue; }
    console.log(`\n== ${id}${s.orch ? ' (orchestral)' : ''}${s.sym ? ', symphonic' : ''}: first pass ${s.first.toFixed(0)} s, loop ${s.loop.toFixed(0)} s`);
    console.log(`  ${s.desc}`);
    console.log(`  form: ${s.form}`);
    console.log(`  notes moved onto the chord: ${s.snaps.length}${s.snaps.length ? '  (' + s.snaps.slice(0, 8).map(x => `${x.sec} ${x.key} bar ${x.bar}`).join('; ') + ')' : ''}`);
    console.log(`  melody's strong beats on the chord: ${s.strong === null ? '-' : Math.round(s.strong * 100) + '%'} · nothing moving in ${Math.round(s.still * 100)}% of the time${s.warn.length ? ' · warnings: ' + s.warn.join('; ') : ''}`);
    if (opt['no-render']) continue;
    const r = await page.evaluate(async ([id, secs, SR]) => { const b = await MOO.Audio.Music.renderOffline(id, secs, { loop: false, sampleRate: SR }); const a = AudioMetrics.analyze(b); return { wav: AudioMetrics.wavBase64(b), lufs: a.lufs, peak: a.peakDb, knee: a.kneePct, lra: a.lra }; }, [id, Math.min(s.first + 6, 480), SR]);
    const base = path.join(OUT, id.replace(/[^a-z0-9]+/gi, '_')), wav = base + '.wav';
    fs.writeFileSync(wav, Buffer.from(r.wav, 'base64'));
    console.log(`  render: ${r.lufs.toFixed(1)} LUFS, peak ${r.peak.toFixed(1)} dB, loudness range ${r.lra.toFixed(1)} LU, limiter ${r.knee.toFixed(2)}%`);
    const py = execFileSync('python3', ['-c', `
import subprocess,numpy as np,sys
x=np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',sys.argv[1],'-ar','24000','-f','f32le','-'],capture_output=True).stdout,dtype=np.float32).reshape(-1,2)
m=x.mean(1); N=8192; w=np.hanning(N); S=np.zeros(N//2+1)
for i in range(0,len(m)-N,N): S+=np.abs(np.fft.rfft(m[i:i+N]*w))**2
fr=np.fft.rfftfreq(N,1/24000); b=[40,80,160,320,640,1280,2560,5120,10240]
e=[10*np.log10(S[(fr>=b[i])&(fr<b[i+1])].sum()+1e-12) for i in range(8)]; mx=max(e)
mud=10*np.log10(S[(fr>=200)&(fr<500)].sum()/S[fr>=40].sum())
lo=np.array([v for v in x]);
def lp(sig,f):
  X=np.fft.rfft(sig); F=np.fft.rfftfreq(len(sig),1/24000); X[F>f]=0; return np.fft.irfft(X,len(sig))
L=lp(x[:,0],150); R=lp(x[:,1],150); c=np.sum(L*R)/np.sqrt(np.sum(L*L)*np.sum(R*R)+1e-15)
print('  bands 40..10k: '+' '.join('%+.0f'%(v-mx) for v in e)+'   200-500 share %.1f dB   low-end centre (corr <150 Hz) %.2f'%(mud,c))
`, wav]).toString();
    process.stdout.write(py);
    process.stdout.write(execFileSync('python3', [path.join(__dirname, 'harsh.py'), wav]).toString().replace(/^/, '  '));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '256k', base + '.mp3']); fs.unlinkSync(wav);
    console.log('  -> ' + base + '.mp3');
  }
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
