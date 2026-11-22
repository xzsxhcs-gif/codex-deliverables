"""Compose the five stereo stems, master and sample-indexed peak data for the film."""
from pathlib import Path
import json
import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'render'
RATE=48000
DURATION=38
BPM=124
BEAT=60/BPM
STEMS=['FX','DRUMS','BASS','SYNTH','LEAD']
rng=np.random.default_rng(8140)
length=RATE*DURATION
tracks={name:np.zeros((length,2),np.float32) for name in STEMS}
events=[]
def hz(note): return 440*2**((note-69)/12)
def timegrid(dur): return np.arange(round(dur*RATE))/RATE
def env(x,attack,release):
    return np.minimum(x/max(attack,.0001),1)*np.clip((x[-1]-x)/max(release,.0001),0,1)
def filt(x,cut,kind='lowpass',order=2):
    return signal.sosfilt(signal.butter(order,cut,fs=RATE,btype=kind,output='sos'),x)
def band(x,lo,hi): return filt(filt(x,lo,'highpass'),hi)
def place(track,beat,y,vel=1,pan=0,name='',note=None):
    sample=round(beat*BEAT*RATE); y=np.asarray(y)
    take=min(len(y),length-sample)
    if take<=0: return
    gains=np.array([np.sqrt(1-pan),np.sqrt(1+pan)])*(.707*vel)
    tracks[track][sample:sample+take] += y[:take,None]*gains
    events.append(dict(stem=track,sound=name,sample=sample,seconds=round(sample/RATE,5),length=take,pitch=note))
def drum(kind,vel=1):
    d={'K':.39,'S':.31,'H':.102,'O':.29,'R':.091,'T':.23,'C':1.15}[kind]
    x=timegrid(d); white=rng.normal(0,1,len(x))
    if kind=='K':
        ph=2*np.pi*(47*x+83*.033*(1-np.exp(-x/.033))+190*.004*(1-np.exp(-x/.004)))
        v=np.tanh(1.40*np.sin(ph))*np.exp(-x/.107)+.26*band(white,1200,8800)*np.exp(-x/.006)
    elif kind=='S':
        cl=sum(np.exp(-np.maximum(x-t,0)/.028)*(x>=t)*a for t,a in [(0,.8),(.011,.58),(.023,1)])
        v=.46*band(white,830,10400)*(cl+.52*np.exp(-x/.099))+.51*np.sin(2*np.pi*(174*x+96*.018*(1-np.exp(-x/.018))))*np.exp(-x/.048)
    elif kind in ['H','O','C']:
        metal=sum(np.sign(np.sin(2*np.pi*f*x)) for f in [213,307,413,513,633,817])*.15
        v=filt(white*.43+metal,5900,'highpass')*np.exp(-x/{'H':.022,'O':.077,'C':.31}[kind])
    elif kind=='R':
        v=(np.sin(2*np.pi*781*x)+.43*np.sin(2*np.pi*1211*x))*.42*np.exp(-x/.012)+.2*band(white,1400,4400)*np.exp(-x/.011)
    else:
        v=np.sin(2*np.pi*(89*x+80*.041*(1-np.exp(-x/.041))))*np.exp(-x/.079)
    return v*env(x,.0006,.015)
def saw(p,harmonics=9):
    return sum(np.sin(2*np.pi*p*k)/k for k in range(1,harmonics+1))*.65
def bass(note,beats,slide=False):
    d=beats*BEAT+.052; x=timegrid(d); f=hz(note)
    p=f*x+f*(.075 if slide else .013)*.024*(1-np.exp(-x/.024))
    sy=.91*np.sin(2*np.pi*p)+.32*np.sin(4*np.pi*p+.32)+saw(p,9)*(.14+.42*np.exp(-x/.072))
    return np.tanh(sy*1.12)*env(x,.004,.048)*(.68+.32*np.exp(-x/.12))
def glass(note,beats,offset):
    x=timegrid(beats*BEAT+.16); f=hz(note)
    y=.48*saw(f*x,7)+.28*saw(f*1.0026*x+offset,7)+.26*np.sin(2*np.pi*f*.998*x)
    return filt(y,2500)*env(x,.012,.15)*(.23+.77*np.exp(-x/.17))
def reed(note,beats,prev=None,octave=False):
    x=timegrid(beats*BEAT+.087); f=hz(note); fr0=hz(prev) if prev is not None else f*1.008
    p=f*x+(fr0-f)*.023*(1-np.exp(-x/.023))+.019*(1-np.cos(2*np.pi*5.7*x))*np.minimum(x/.23,1)
    tone=(.63*np.sin(2*np.pi*p+.74*np.exp(-x/.11)*np.sin(2*np.pi*2*p))+.23*np.sin(4*np.pi*p)+.23*np.sin(6*np.pi*p)+.07*np.sin(10*np.pi*p))
    if octave:tone+=.24*saw(p*.5,6)+.075*np.sin(2*np.pi*p*2.002)
    return np.tanh(1.27*tone)*env(x,.02,.082)*(.82+.18*np.exp(-x/.19))
def fx(kind,beats):
    x=timegrid(beats*BEAT); u=x/x[-1];n=rng.normal(size=len(x))
    if kind=='lift':
        y=band(n,1500,9200)*u**2+.22*np.sin(2*np.pi*(365*x+420*x**2/max(x[-1],.01)))*u**3
    elif kind=='down':
        y=.8*band(n,500,8200)*np.exp(-x/.24)+.27*np.sin(2*np.pi*(85*x+130*.075*(1-np.exp(-x/.075))))*np.exp(-x/.135)
    else:
        y=np.sin(2*np.pi*(1250*x+150*x*x))*np.exp(-x/.031)+.27*np.sin(2*np.pi*2055*x)*np.exp(-x/.016)
    return y*env(x,.005,.018)
def delay(name,beats,gains):
    dry=tracks[name].copy()
    for i,g in enumerate(gains,1):
        off=round(RATE*BEAT*beats*i)
        echo=dry[:-off,::-1] if i%2 else dry[:-off]
        tracks[name][off:]+=g*signal.sosfilt(signal.butter(1,3000,fs=RATE,output='sos'),echo,axis=0).astype('f')
def compose():
    chords=[[57,60,64,67,71],[53,57,60,64,67],[55,59,62,64,69],[52,56,59,62,65]]
    roots=[33,29,31,28]
    basslines=[[(0,0,.7),(.87,12,.18),(1.5,0,.32),(2.22,7,.26),(2.97,10,.41),(3.65,7,.23)],
               [(0,0,.86),(1.25,7,.24),(1.77,12,.27),(2.5,0,.46),(3.37,7,.32)],
               [(0,0,.45),(.74,0,.28),(1.5,7,.36),(2.24,12,.46),(3.13,9,.28),(3.73,7,.15)],
               [(0,0,.84),(1.5,7,.36),(2.25,12,.28),(2.75,7,.26),(3.36,4,.32),(3.76,7,.18)]]
    hook=[[(0,76,.57),(.75,72,.29),(1.25,69,.82),(2.5,71,.32),(3,72,.74)],
          [(.0,76,.75),(1,79,.31),(1.5,76,.34),(2,72,.83),(3.25,69,.46)],
          [(.24,74,.46),(1,71,.67),(2.0,67,.41),(2.75,69,.31),(3.25,74,.56)],
          [(0,71,.67),(1,68,.37),(1.5,71,.34),(2,74,.60),(3,76,.46)]]
    for bar in range(20):
        b=bar*4; final=bar>=16; last=bar==19; ix=bar%4
        def hit(k,t,v,pan=0):
            place('DRUMS',b+t,drum(k),v,pan,k)
        if last:
            hit('K',0,.98);hit('C',0,.46,-.27)
            place('FX',b,fx('down',1.75),.24,.16,'sign-off')
            place('BASS',b,bass(33,1.42),.79,0,'tonic',33)
            for j,m in enumerate(chords[0]):place('SYNTH',b+.012*j,glass(m,1.45,j*.19),.20,(j-2)*.28,'last chord',m)
            place('LEAD',b,reed(69,1.34,71,True),.48,.01,'resolution',69)
            break
        # A quiet sixteenth before the full-band downbeat.
        stop=3.02 if bar==15 else 4
        kicks=([0,.76,2,2.73] if ix==0 else [0,1.48,2.25,3.5] if ix==1 else [0,.75,2,3.23] if ix==2 else [0,1.50,2.5])
        for k,t in enumerate(kicks):
            if t<stop:hit('K',t,.92 if k==0 else (.81 if k!=1 else .71))
        for t in [1.012,3.013]:
            if t<stop:hit('S',t,.76 if t<2 else .83)
        for j in range(8):
            t=.5*j+(.037 if j%2 else .006)
            if t>=stop:continue
            hit('O' if j in (3,7) and (bar%2 or final) else 'H',t,.27 if j%2 else .16,(-.28 if j%2 else .18))
        for j in ([2.81,3.78] if ix in [1,3] else [.283,2.79]):
            if j<stop:hit('R',j,.20,.34)
        if bar%4==3 and bar!=15:
            for k,t in enumerate([3.48,3.68,3.845]):
                hit('T' if k==0 else 'S',t,.28+k*.075,(-.3+k*.29))
        if final:
            for j in [.29,1.78,2.29,3.8]:hit('H',j,.19,.42)
        if bar in (0,4,8,12,16):
            place('FX',b,fx('down',1.25),.34 if final else .25,-.14,'air hit')
            if bar in (8,16):hit('C',.003,.38,-.44)
        if ix in (0,2):
            for j,t in enumerate([.50,.805,2.53]):
                place('FX',b+t,fx('blip',.26),[.14,.065,.086][j],[-.52,.45,.37][j],'relay tick')
        if ix==3:place('FX',b+2.52,fx('lift',1.4 if bar!=15 else .58),.24 if bar!=15 else .39,.21,'uplink')
        if bar>=4:
            for j,(t,d,n) in enumerate(basslines[ix]):
                if t<stop:place('BASS',b+t,bass(roots[ix]+d,min(n,stop-t),j%3==1),.70 if j==0 else .60,.0,'rubber bass',roots[ix]+d)
        if bar>=8:
            for idx,(t,l,v) in enumerate([(.49,.42,.20),(1.73,.28,.16),(2.50,.75,.18),(3.50,.26,.13)]):
                if t>=stop:continue
                for j,m in enumerate(chords[ix]):
                    place('SYNTH',b+t+.009*j,glass(m,min(l,stop-t),j*.16),v*(.9 if j in [0,2] else .72),(j-2)*.31,'prism chord',m)
            for j,m in enumerate([chords[ix][-1]+12,chords[ix][2]+12]):
                if 3+.5*j<stop:place('SYNTH',b+3+.5*j,glass(m,.22,j*.22),.126,.49-j*.88,'glass reply',m)
        if bar>=12:
            prev=None
            for t,m,n in hook[ix]:
                if t<stop:place('LEAD',b+t,reed(m,min(n,stop-t),prev if t>0 else None,final),.43 if final else .38,.01,'reed lead',m)
                prev=m
            if final:
                for j,m in enumerate([chords[ix][1]+12,chords[ix][2]+12]):
                    place('LEAD',b+2.73+.72*j,glass(m,.29,.18),.17,-.45+j*.78,'octave answer',m)
    delay('FX',.5,[.22,.1]);delay('SYNTH',.75,[.18,.073]);delay('LEAD',.75,[.19,.075,.03]);delay('DRUMS',.12,[.043])
    # Keep the bass drum transient clear. Apply the same mix-bus gain to every stem.
    duck=np.ones(length)
    for e in events:
        if e['sound']=='K':
            i=e['sample'];x=timegrid(.23);end=min(length-i,len(x))
            duck[i:i+end]=np.minimum(duck[i:i+end],1-.33*np.exp(-x[:end]/.081))
    tracks['BASS']*=duck[:,None];tracks['SYNTH']*=(.6+.4*duck)[:,None]
    mix=sum(tracks.values())
    pk=np.max(np.abs(mix),axis=1); gain=np.minimum(1, (.78/(pk+.001))**.34)
    gain=signal.sosfilt(signal.butter(1,190,fs=RATE,output='sos'),np.pad(gain,(512,0),mode='edge'))[512:]
    mx=np.max(np.abs(mix*gain[:,None]));gain*=.925/mx
    fade=np.minimum(1,np.arange(length)[::-1]/(RATE*.27))**1.5
    for name in STEMS:tracks[name]*=(gain*fade)[:,None]
    write()
def write():
    OUT.mkdir(exist_ok=True);(OUT/'stems').mkdir(exist_ok=True)
    mix=sum(tracks.values())
    def wav(path,y):wavfile.write(path,RATE,np.rint(np.clip(y,-1,1)*32767).astype('<i2'))
    wav(OUT/'master.wav',mix)
    peaks={}
    for name in STEMS+['MIX']:
        y=mix if name=='MIX' else tracks[name]
        if name!='MIX':wav(OUT/'stems'/f'{name}.wav',y)
        v=np.max(np.abs(y),axis=1).reshape(-1,160)
        peaks[name]=v.max(axis=1).astype('f')
    np.savez_compressed(OUT/'peaks.npz',**peaks)
    (OUT/'score.json').write_text(json.dumps(dict(bpm=BPM,sample_rate=RATE,duration=DURATION,events=sorted(events,key=lambda e:e['sample'])),separators=(',',':')))
    print('Peak',float(np.max(abs(mix))),'RMS',float(np.sqrt(np.mean(mix**2))),'events',len(events))
if __name__=='__main__':compose()
