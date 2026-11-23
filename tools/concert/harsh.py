# scan a render for sudden harsh bursts: energy above 2.5 kHz jumping well over its surroundings, and rough partial pairs
import subprocess,sys,numpy as np
sr=24000
for f in sys.argv[1:]:
    x=np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',f,'-ar',str(sr),'-ac','1','-f','f32le','-'],capture_output=True).stdout,dtype=np.float32)
    N=2048; H=1200; w=np.hanning(N); fr=np.fft.rfftfreq(N,1/sr)
    hi=[]; tot=[]
    for i in range(0,len(x)-N,H):
        S=np.abs(np.fft.rfft(x[i:i+N]*w))**2; hi.append(10*np.log10(S[fr>2500].sum()+1e-12)); tot.append(10*np.log10(S.sum()+1e-12))
    hi=np.array(hi); tot=np.array(tot); base=np.convolve(hi,np.ones(81)/81,mode='same'); rel=hi-tot
    ev=[]; 
    for k in np.argsort(-(hi-base)):
        if hi[k]-base[k]<9: break
        t=k*H/sr
        if all(abs(t-e[0])>2 for e in ev): ev.append((t,hi[k]-base[k],rel[k]))
        if len(ev)>=8: break
    print(f.split('/')[-1], 'bursts >9 dB over their surroundings:', ', '.join(f'{int(t//60)}:{t%60:04.1f} (+{d:.0f} dB, hi/total {r:.0f} dB)' for t,d,r in sorted(ev)) or 'none')
