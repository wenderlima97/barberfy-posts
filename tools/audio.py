#!/usr/bin/env python3
"""Trilha e efeitos originais (sintetizados) sincronizados com a timeline do reel.
Uso: python3 tools/audio.py timeline.json saida.wav"""
import json,sys,numpy as np
from scipy import signal
from scipy.io import wavfile
SR=44100
tl=json.load(open(sys.argv[1]));TOT=tl['total']
N=int((TOT+0.6)*SR)
rng=np.random.default_rng(7)
def lp(x,f,o=2):b,a=signal.butter(o,f/(SR/2),'low');return signal.lfilter(b,a,x)
def hp(x,f,o=2):b,a=signal.butter(o,f/(SR/2),'high');return signal.lfilter(b,a,x)
def bp(x,f1,f2,o=2):b,a=signal.butter(o,[f1/(SR/2),f2/(SR/2)],'band');return signal.lfilter(b,a,x)
def put(buf,x,t,g=1.0):
    i=int(t*SR)
    if i>=len(buf):return
    x=x[:len(buf)-i];buf[i:i+len(x)]+=x*g
def saw(f,d):
    t=np.arange(int(d*SR))/SR;return 2*((t*f)%1)-1
def env(n,a=0.005,r=0.2):
    e=np.ones(n);na=max(1,int(a*SR));nr=max(1,int(r*SR));e[:na]=np.linspace(0,1,na);e[-nr:]*=np.linspace(1,0,nr);return e
def kick():
    t=np.arange(int(0.32*SR))/SR;f=45+110*np.exp(-t*28);ph=2*np.pi*np.cumsum(f)/SR
    return np.sin(ph)*np.exp(-t*9)+0.25*np.sin(ph*2)*np.exp(-t*30)
def hat(open_=False):
    d=0.22 if open_ else 0.06;n=int(d*SR);t=np.arange(n)/SR
    return hp(rng.standard_normal(n),7000)*np.exp(-t*(14 if open_ else 55))
def clap():
    n=int(0.2*SR);t=np.arange(n)/SR;x=bp(rng.standard_normal(n),900,3500)
    e=np.exp(-t*25)+0.6*np.exp(-((t-0.012)*220)**2)+0.5*np.exp(-((t-0.024)*220)**2);return x*e
def whoosh(d=0.45,up=True):
    n=int(d*SR);x=rng.standard_normal(n);t=np.linspace(0,1,n)
    f=(400+5200*t**2) if up else (5600-5200*t)
    out=np.zeros(n);blk=512
    for i in range(0,n-blk,blk):
        fc=float(f[i]);b,a=signal.butter(2,[max(200,fc*0.6)/(SR/2),min(fc*1.4,20000)/(SR/2)],'band')
        out[i:i+blk]=signal.lfilter(b,a,x[i:i+blk])
    return out*np.sin(np.pi*t)**1.5
def blip(f=1100,d=0.12):
    t=np.arange(int(d*SR))/SR;return (np.sin(2*np.pi*f*t)+0.4*np.sin(2*np.pi*f*2*t))*np.exp(-t*30)
def pop(d=0.1):
    t=np.arange(int(d*SR))/SR;f=420-250*t/d;return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*40)
def impact(d=1.4):
    n=int(d*SR);t=np.arange(n)/SR;sub=np.sin(2*np.pi*np.cumsum(38+90*np.exp(-t*12))/SR)*np.exp(-t*3.2)
    nz=lp(rng.standard_normal(n),3000)*np.exp(-t*7)*0.5;return sub+nz
def riser(d):
    n=int(d*SR);t=np.linspace(0,1,n);x=rng.standard_normal(n);out=np.zeros(n);blk=512
    for i in range(0,n-blk,blk):
        fc=300+7000*t[i]**2;b,a=signal.butter(2,[fc*0.5/(SR/2),min(fc*1.5,20000)/(SR/2)],'band');out[i:i+blk]=signal.lfilter(b,a,x[i:i+blk])
    return out*t**2
def reverb(x,wet=0.25,d=0.9):
    n=int(d*SR);ir=rng.standard_normal(n)*np.exp(-np.arange(n)/SR*5);ir=lp(ir,6000)
    y=signal.fftconvolve(x,ir)[:len(x)];y/=np.max(np.abs(y))+1e-9;return x*(1-wet)+y*wet*np.max(np.abs(x))

BPM=104;beat=60/BPM
sc=tl['scenes'];groove0=sc[1]['start'] if len(sc)>1 else 0.0
music=np.zeros(N);duck=np.ones(N)
# pad: acordes Am - F - C - G, uma barra (4 tempos) cada
chords=[[220,261.6,329.6],[174.6,220,261.6],[261.6,329.6,392],[196,246.9,293.7]]
bar=4*beat;nb=int((TOT+0.6)/bar)+2
pad=np.zeros(N)
for b in range(nb):
    ch=chords[b%4]
    for f in ch:
        for det in (0.996,1.004):
            x=saw(f*det,bar+0.5);x=lp(x,1400)*env(len(x),0.35,0.5)*0.05;put(pad,x,b*bar)
music+=pad
# ruído de entrada: riser na cena 0
if groove0>0.5:
    r=riser(groove0)*0.28;put(music,r,0)
# groove a partir da cena 1
t=groove0;k=0
bass_notes=[55,55,65.4,49]  # A1 A1 C2 G1
bassbus=np.zeros(N);drums=np.zeros(N)
while t<TOT+0.3:
    step=k%4;barn=(k//4)
    if True:
        put(drums,kick(),t,0.95)
        i0=int(t*SR);i1=min(N,int((t+beat)*SR));tt=np.arange(i1-i0)/SR;duck[i0:i1]=np.minimum(duck[i0:i1],1-0.55*np.exp(-tt/0.14))
        if step in (1,3):put(drums,clap(),t,0.5)
        put(drums,hat(False),t+beat/2,0.28)
        if step==3:put(drums,hat(True),t+beat*0.75,0.18)
        put(drums,hat(False),t+beat*0.25,0.12);put(drums,hat(False),t+beat*0.75,0.12)
        f=bass_notes[(barn%4)] if step!=2 else bass_notes[(barn%4)]*(1.5 if barn%2 else 1)
        for sub,gain in ((0,1.0),):
            x=saw(f,beat*0.9);x=lp(x,260)*env(len(x),0.004,0.25);x=x+np.sin(2*np.pi*f*np.arange(len(x))/SR)*0.8
            put(bassbus,x,t+(beat*0.5 if step==2 else 0),0.28)
    t+=beat;k+=1
music=music*duck*1.0+bassbus*duck+drums
# SFX
sfx=np.zeros(N)
for e in tl['events']:
    ty,tt=e['type'],e['t']
    if ty=='scene':
        put(sfx,whoosh(0.4,True),max(0,tt-0.15),0.55);put(sfx,pop(),tt+0.2,0.35)
    elif ty=='title':
        put(sfx,whoosh(0.35,False),tt,0.4);put(sfx,impact(1.1),tt+0.05,0.35)
    elif ty=='bar':
        put(sfx,whoosh(0.25,True),tt,0.35)
    elif ty=='b':
        put(sfx,pop(),tt,0.55);put(sfx,blip(1320,0.1),tt+0.05,0.28)
    elif ty=='k':
        put(sfx,blip(880,0.09),tt,0.18)
    elif ty=='sub':
        put(sfx,blip(990,0.12),tt,0.22)
    elif ty=='cta':
        put(sfx,blip(660,0.12),tt,0.3);put(sfx,blip(990,0.18),tt+0.1,0.3)
    elif ty=='lg':
        put(sfx,impact(1.6),tt,0.55)
        for f in (440,554.4,659.3,880):
            x=np.sin(2*np.pi*f*np.arange(int(1.5*SR))/SR)*np.exp(-np.arange(int(1.5*SR))/SR*2.2);put(sfx,x,tt,0.07)
sfx=reverb(sfx,0.2)
mix=music*0.9+sfx
# fade-out final e normalização
fo=int(1.0*SR);end=int((TOT+0.2)*SR);mix[end-fo:end]*=np.linspace(1,0,fo);mix[end:]=0
mix=np.tanh(mix*1.4)/np.tanh(1.4);mix/=np.max(np.abs(mix))+1e-9;mix*=0.80
mix=mix[:int(TOT*SR)] if False else mix[:int((TOT+0.2)*SR)]
wavfile.write(sys.argv[2],SR,(mix*32767).astype(np.int16))
print('audio ok',round(len(mix)/SR,1),'s')
