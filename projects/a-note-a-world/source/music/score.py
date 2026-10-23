"""Where Light Returns / 微光归途 — an original 32-bar instrumental score.

Uses reaesteve's AI_MUSIC_CREATOR engine (CC BY-NC-SA 4.0), TinySoundFont
(MIT), and GeneralUser GS (its original license). See the adjacent notices.
Every pitch/rhythm below is deliberate; seeded variation affects performance only.
"""
from __future__ import annotations
import argparse, hashlib, json, math, os, shutil, subprocess, sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

ROOT=Path(__file__).resolve().parent
ENGINE=ROOT/'engine'; WORK=ROOT/'work'; SOUNDFONT=ROOT/'sound_library/GeneralUser-GS/GeneralUser-GS.sf2'
sys.path.insert(0,str(ENGINE))
import compose_kit as ck

TITLE='Where Light Returns / 微光归途'
FONT_SHA='9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe'
END_BEAT=128
INSTRUMENTS=[
    (0,'Piano',0,1.20,-.07,.23,48),
    (1,'Cello',42,.83,.14,.20,70),
    (2,'Violin',40,.88,-.24,.29,170),
    (3,'String ensemble',49,.56,-.03,.38,125),
    (4,'Flute',73,.67,-.14,.35,250),
    (5,'French horns',60,.55,.23,.26,130),
    (6,'Harp',46,.64,.29,.32,120),
    (7,'Timpani',47,.77,.04,.10,35),
    (9,'Orchestral cymbals',48,.44,.13,.18,330),
]
THEME=[
 [('F#4',.5),('A4',.5),('D5',1.5),('C#5',.5),('B4',.5),(None,.5)],
 [('A4',1.5),('B4',.5),('D5',1),('F#5',.5),(None,.5)],
 [('F#4',.5),('A4',.5),('D5',1),('E5',.5),('F#5',.5),('E5',.5),('D5',.5)],
 [('C#5',1.5),('B4',.5),('A4',1),(None,1)],
 [('F#4',.5),('A4',.5),('D5',1.5),('E5',.5),('F#5',.5),(None,.5)],
 [('G5',1),('F#5',.5),('E5',.5),('D5',1.5),(None,.5)],
 [('E5',1),('D5',.5),('B4',.5),('C#5',.5),('E5',.5),('B4',.5),('A4',.5)],
 [('F#4',.5),('A4',.5),('D5',2),(None,1)],
]
HARMONY=[
 [('Bm9',4)],[('Gmaj9',4)],[('D/F#',4)],[('Aadd9',2),('A7',2)],
 [('Bm9',4)],[('Gmaj9',4)],[('D/F#',4)],[('Aadd9',2),('A7',2)],
 [('Bm7',4)],[('Gmaj9',4)],[('Em7',2),('A7',2)],[('Dadd9',4)],
 [('Em7',4)],[('Bm7/F#',4)],[('Gmaj9',4)],[('Aadd9',4)],
 [('Bm7',4)],[('D/F#',4)],[('Gmaj9',4)],[('A7',4)],
 [('Dadd9',4)],[('A/C#',4)],[('Bm7',4)],[('Gmaj9',4)],
 [('D/F#',4)],[('Em7',2),('A7',2)],[('Gmaj7',2),('A7',2)],[('Dadd9',4)],
 [('Gmaj9',4)],[('D/F#',4)],[('Em7',2),('A7',2)],[('Dadd9',4)],
]
PIANO_TONES={
 'Bm9':['B2','F#3','A3','C#4'], 'Bm7':['B2','F#3','A3','D4'],
 'Gmaj9':['G2','D3','F#3','A3','B3'], 'Gmaj7':['G2','D3','F#3','B3'],
 'D/F#':['F#2','A2','D3','F#3','A3'], 'Dadd9':['D2','A2','E3','F#3','A3'],
 'Aadd9':['A2','E3','B3','C#4'], 'A7':['A2','E3','G3','C#4'],
 'Em7':['E2','B2','D3','G3','B3'], 'A/C#':['C#3','E3','A3','C#4'],
 'Bm7/F#':['F#2','B2','D3','F#3','A3'],
}


def n(ch,pitch,measure,offset,duration,velocity,tag=None,hum=.006):
    ck.note(ch,pitch,ck.bar(measure)+offset,duration,velocity,hum=hum,tag=tag)

def line(ch,measure,items,velocity,tag=None,legato=.055):
    assert abs(sum(d for _,d in items)-4)<1e-9,(measure,items)
    ck.melody(ch,ck.bar(measure),items,vel=velocity,legato=legato,tag=tag)

def swell(ch,b0,b1,a,b):ck.expression(ch,b0,b1,a,b,step=.125)

def schedule_strings(first,last,velocity):
    progression=[item for row in HARMONY[first-1:last] for item in row]
    ck.chords(3,ck.bar(first),progression,vel=velocity,lo=55,hi=74,n=4)

def piano_accompaniment(measure,activity,velocity):
    offset=0
    for symbol,length in HARMONY[measure-1]:
        tones=PIANO_TONES[symbol]
        if activity=='sparse':
            pattern=[(0,0,min(2.5,length-.08)),(.8,min(1,len(tones)-1),1.1),(2.5,len(tones)-1,.85)]
        elif activity=='flow':
            order=[0,1,2,len(tones)-1,2,1,3 if len(tones)>3 else 2,1]
            pattern=[(k*.5,j,.44 if k%2 else .64) for k,j in enumerate(order)]
        else:
            pattern=[(0,0,min(length-.07,1.7)),(1,1,.72),(2,min(2,len(tones)-1),.66),(3,len(tones)-1,.72)]
        for off,idx,dur in pattern:
            if off>=length-.1:continue
            n(0,tones[idx],measure,offset+off,min(dur,length-off-.04),velocity+(3 if off==0 else -3 if off%1 else 0),'piano-harmony')
        offset+=length

def merge_tied_strings_and_protect_retriggers():
    # Preserve common tones instead of cutting a newly retriggered SF voice with an old note-off.
    by_key={}
    for note in ck.NOTES:by_key.setdefault((note['ch'],note['pitch']),[]).append(note)
    result=[]
    for (ch,pitch),notes in by_key.items():
        notes.sort(key=lambda a:a['b0']);retained=[]
        for note in notes:
            if ch==3 and retained and note['b0']-retained[-1]['b1']<.12:
                retained[-1]['b1']=max(retained[-1]['b1'],note['b1'])
            else:retained.append(note)
        for a,b in zip(retained,retained[1:]):
            if a['b1']>=b['b0']-.012:a['b1']=b['b0']-.025
        result.extend(retained)
    ck.NOTES[:]=sorted(result,key=lambda a:(a['b0'],a['ch'],a['pitch']))

def write_score():
    ck.CHORD_Q['maj9']=[0,4,7,11,14]
    ck.tempo([(0,112,90,90),(112,128,90,70)],intro=.3,tail=3.0,seed=231026)
    for ch,name,program,gain,pan,reverb,hpf in INSTRUMENTS:
        ck.channel(ch,name,program,gain=gain,pan=pan,reverb=reverb,hpf=hpf,haas=0)
    # 1–4: the original theme in a small, intimate piano space.
    for m in range(1,5):
        line(0,m,THEME[m-1],63 if m<4 else 60,'theme-opening',legato=.025)
        piano_accompaniment(m,'sparse',39)
    # 5–12: the first complete statement; cello and then a slow string canopy.
    for m in range(5,13):
        line(0,m,THEME[m-5],70+(m>=9)*2,'theme-development',legato=.035)
        piano_accompaniment(m,'gentle',44)
    cello_development=[
      [('B2',2.75),('F#3',1),(None,.25)], [('G2',2.5),('A2',.5),('B2',.75),(None,.25)],
      [('F#2',2),('A2',1),('D3',.8),(None,.2)], [('A2',3),('G2',.75),(None,.25)],
      [('B2',2),('D3',1),('F#3',.8),(None,.2)], [('G2',2),('B2',1),('D3',.8),(None,.2)],
      [('E3',1.5),('B2',.5),('C#3',1),('A2',.75),(None,.25)], [('D3',3.7),(None,.3)]]
    for m,items in enumerate(cello_development,5):line(1,m,items,61+(m>=9)*3,'cello-development',legato=.075)
    schedule_strings(7,12,54)
    for m in [9,10,11,12]:
        symbol=HARMONY[m-1][0][0];notes=PIANO_TONES[symbol][1:]
        for k,off in enumerate([.5,1.5,2.75]):n(6,ck.p(notes[k%len(notes)])+12,m,off,.75,41,'harp-glints')
    # 13–20: the head migrates to violin; the piano becomes an interlocking figure.
    development=[
      [('B4',.5),('D5',.5),('G5',1.5),('F#5',.5),('E5',.5),(None,.5)],
      [('F#5',1.5),('E5',.5),('D5',1),('B4',.5),(None,.5)],
      [('B4',.5),('D5',.5),('G5',1),('A5',.5),('G5',.5),('F#5',.5),('E5',.5)],
      [('E5',1.5),('C#5',.5),('B4',1),(None,1)],
      [('F#5',.5),('A5',.5),('D5',1.5),('E5',.5),('F#5',.5),(None,.5)],
      [('A5',1),('F#5',.5),('E5',.5),('D5',1.5),(None,.5)],
      [('B4',1),('D5',.5),('F#5',.5),('A5',1),('G5',.5),(None,.5)],
      [('E5',1.5),('G5',.5),('C#5',1),(None,1)]]
    for m,items in enumerate(development,13):
        line(2,m,items,68+min(7,m-13),'theme-variation',legato=.09)
        piano_accompaniment(m,'flow',46+(m>=17)*3)
    schedule_strings(13,20,60)
    bass_roots=['E3','F#2','G2','A2','B2','F#2','G2','A2']
    for m,root in enumerate(bass_roots,13):
        n(1,root,m,0,2.7,65,'cello-build')
        fifth=ck.p(root)+7
        n(1,fifth,m,3,.8,59,'cello-answer')
        # Six notes, with gaps, rather than an endless rolled texture.
        tones=PIANO_TONES[HARMONY[m-1][0][0]][1:]
        for k,off in enumerate([0,.5,1.5,2,2.5,3.5]):
            if m==20 and off>=3.5:continue
            n(6,ck.p(tones[k%len(tones)])+12,m,off,.62,43+(m>=17)*4,'harp-motion')
    # Breath-shaped flute answers, separate from the violin's sustained notes.
    flute_build=[(15,3.25,'A5',.55),(16,3,'B5',.72),(17,.1,'F#5',1.1),
                 (18,3,'E5',.72),(19,.15,'F#5',.85),(20,2.5,'G5',.45),(20,3,'E5',.45)]
    for m,off,pitch,duration in flute_build:n(4,pitch,m,off,duration,56,'flute-answer')
    # Horns enter as quiet inner harmony, not a trailer-style brass hit.
    for m in range(17,21):
        horn={'Bm7':['D4','F#4'],'D/F#':['A3','D4'],'Gmaj9':['B3','D4'],'A7':['G3','C#4']}[HARMONY[m-1][0][0]]
        for pitch in horn:n(5,pitch,m,.18,3.35,54+(m-17),'horn-support')
    # 21–28: a full orchestral theme, with one local registral lift only.
    climax=[
      [('F#5',.5),('A5',.5),('D6',1.5),('C#6',.5),('B5',.5),(None,.5)],
      [('A5',1),('F#5',1),('E5',.5),('C#5',1),(None,.5)],
      THEME[2],THEME[3],THEME[4],
      [('G5',1),('F#5',.5),('E5',.5),('D5',1.5),(None,.5)],
      [('D5',1),('B4',1),('C#5',.5),('E5',.5),('G5',.5),(None,.5)],
      [('F#5',.5),('E5',.5),('D5',2.5),(None,.5)]]
    for m,items in enumerate(climax,21):
        line(2,m,items,79 if m<25 else 76,'theme-climax',legato=.09)
        piano_accompaniment(m,'flow' if m<28 else 'gentle',50 if m<25 else 47)
    schedule_strings(21,28,68)
    cello_climax=[
      [('D3',2),('F#3',1),('E3',1)], [('C#3',2),('E3',1),('A2',1)],
      [('B2',2),('F#3',1),('D3',1)], [('G2',2),('B2',1),('A2',1)],
      [('F#2',2),('A2',1),('D3',1)], [('E3',1.5),('B2',.5),('C#3',1),('A2',1)],
      [('G2',1.5),('B2',.5),('A2',1.5),('E3',.5)], [('D3',3.75),(None,.25)]]
    for m,items in enumerate(cello_climax,21):line(1,m,items,73,'cello-counterpoint',legato=.085)
    for m in range(21,29):
        for k,off in enumerate([.25,.75,1.25,2,2.75,3.25]):
            boundary=0
            for symbol,length in HARMONY[m-1]:
                boundary+=length
                if off<boundary:break
            tones=PIANO_TONES[symbol][1:]
            n(6,ck.p(tones[k%len(tones)])+12,m,off,.65,51,'harp-climax')
    horn_climax={21:['F#3','A3','D4'],22:['E3','A3','C#4'],23:['F#3','B3','D4'],24:['G3','B3','D4'],25:['F#3','A3','D4'],26:['G3','B3','E4'],27:['G3','B3','D4'],28:['F#3','A3','D4']}
    for m,tones in horn_climax.items():
        for pitch in tones:n(5,pitch,m,.10,3.48 if m<28 else 3.15,62 if m<25 else 58,'horn-chorale')
        if m in [26,27]:
            # The dominant arrives after Em7 / Gmaj7; do not leave wrong inner tones under A7.
            for note in ck.NOTES:
                if note['ch']==5 and ck.bar(m)<=note['b0']<ck.bar(m+1):note['b1']=min(note['b1'],ck.bar(m)+1.94)
            for pitch in ['G3','A3','C#4']:n(5,pitch,m,2.04,1.48,58,'horn-dominant')
    for m,off,pitch,duration in [(21,2.8,'A5',.75),(22,2.5,'E5',1),(24,2.8,'D5',.85),(26,1.1,'G5',.65),(27,2.7,'E5',.85),(28,2.6,'A4',.85)]:
        n(4,pitch,m,off,duration,60,'flute-counterpoint')
    # A small timpani pickup and a few harmonic arrivals; no continuous drum groove.
    for k in range(4):n(7,'A2',20,3+k*.2,.14,29+k*3,'timpani-pickup',hum=.002)
    for m,pitch,vel in [(21,'D2',52),(24,'G2',40),(25,'D2',47),(27,'G2',38)]:n(7,pitch,m,0,1.4,vel,'timpani-arrival',hum=.002)
    n(7,'A2',27,2,1.3,43,'timpani-dominant',hum=.002)
    for m,vel in [(21,40),(25,33)]:n(9,49,m,0,.8,vel,'soft-cymbal',hum=.002)
    # 29–32: the original head is remembered quietly; the harmony comes home.
    ending=[THEME[0],THEME[1],
       [('E5',1),('D5',.5),('B4',.5),('C#5',1),('A4',1)],
       [('D5',1.5),('A4',.5),('F#4',.5),('D4',1.1),(None,.4)]]
    for m,items in enumerate(ending,29):
        line(0,m,items,61-(m-29)*4,'theme-return',legato=.025)
        piano_accompaniment(m,'sparse',36-(m-29))
    schedule_strings(29,32,44)
    for m,pitch in [(29,'G2'),(30,'F#2'),(31,'E3'),(32,'D3')]:n(1,pitch,m,.02,3.4 if m!=31 else 1.8,49-(m-29)*2,'cello-return')
    n(1,'A2',31,2.02,1.65,44,'cello-cadence')
    for pitch,off in [('D4',0),('F#4',.45),('A4',.9),('E5',1.35),('D5',1.8)]:n(6,pitch,32,off,1.25,34,'harp-final')
    # Expression data controls real note gain in both the renderer and MIDI.
    for ch in [0,1,2,3,4,5,6,7,9]:
        swell(ch,0,1,105 if ch==0 else 85,105 if ch==0 else 85)
    swell(1,ck.bar(5),ck.bar(12),83,98);swell(1,ck.bar(13),ck.bar(21),94,108)
    swell(3,ck.bar(7),ck.bar(13),75,94);swell(3,ck.bar(13),ck.bar(21),94,110)
    swell(2,ck.bar(13),ck.bar(21),88,108);swell(4,ck.bar(15),ck.bar(21),88,101)
    swell(5,ck.bar(17),ck.bar(21),82,104);swell(6,ck.bar(9),ck.bar(21),82,102)
    for ch in [1,2,3,4,5,6]:
        swell(ch,ck.bar(21),ck.bar(25),108 if ch!=6 else 101,113 if ch in [2,3] else 108)
        swell(ch,ck.bar(25),ck.bar(29),113 if ch in [2,3] else 108,82)
    swell(0,ck.bar(29),128,103,79);swell(1,ck.bar(29),128,80,61);swell(3,ck.bar(29),128,77,53);swell(6,ck.bar(29),128,80,60)
    merge_tied_strings_and_protect_retriggers()
    # Keep the ending inside the musical boundary; the three-second release is separate.
    for note in ck.NOTES:
        note['b0']=max(0,note['b0']);note['b1']=min(127.92,note['b1'])
        assert note['b1']>note['b0'] and 0<=note['pitch']<=127
    return ck.export(END_BEAT)


def enrich_outputs(total):
    ck._midi(END_BEAT,key_signature=(2,0))
    data=json.loads(Path('notes.json').read_text())
    for row,source in zip(data['notes'],ck.NOTES):
        row.update(pitch=row['p'],velocity=row['v'],start_seconds=row['t0'],end_seconds=row['t1'],duration_seconds=round(row['t1']-row['t0'],5),start_beat=round(source['b0'],6),end_beat=round(source['b1'],6))
    sections=[('opening',1,5),('development',5,13),('build',13,21),('climax',21,29),('return',29,33)]
    data.update(title=TITLE,key='D major / relative B minor',meter='4/4',tempo_map=ck.TEMPO,
                instruments=[{'channel':ch,'name':name,'program_0_based':program,'soundfont_bank':128 if ch==9 else 0,'gain':gain,'pan':pan,'reverb_send':reverb} for ch,name,program,gain,pan,reverb,hpf in INSTRUMENTS],
                sections=[{'name':name,'first_bar':a,'end_bar_exclusive':b,'start_seconds':round(ck.beat2sec(ck.bar(a)),5),'end_seconds':round(ck.beat2sec(ck.bar(b)),5)} for name,a,b in sections],
                controllers=[{'channel':ch,'controller':ctrl,'value':value,'time_seconds':round(max(0,ck.beat2sec(beat)-.001),5)} for beat,ch,ctrl,value in ck.CC],
                soundfont_sha256=FONT_SHA,tail_seconds=3.0)
    Path('notes.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    for name in ['song.mid','notes.json','mix.json']:
        shutil.copy2(name,ROOT/name)
    return data


def build_renderer():
    suffix='.exe' if os.name=='nt' else ''
    exe=WORK/('render'+suffix)
    cc=shutil.which('gcc') or shutil.which('cc')
    if cc:command=[cc,'-O2','-o',str(exe),str(ENGINE/'render.c'),'-lm']
    elif os.name=='nt' and shutil.which('cl'):
        command=['cl','/nologo','/O2',str(ENGINE/'render.c'),'/Fe:'+str(exe)]
    else:raise RuntimeError('A C compiler is required: gcc/cc, or cl in a Visual Studio Developer Command Prompt.')
    subprocess.run(command,cwd=WORK,check=True)
    return exe


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--score-only',action='store_true');ap.add_argument('--workers',type=int,default=2);args=ap.parse_args()
    if not SOUNDFONT.exists():
        parts=sorted(SOUNDFONT.parent.glob('GeneralUser-GS.sf2.part_*'))
        if len(parts)!=4:raise FileNotFoundError('The original project SoundFont or its four parts is required.')
        with SOUNDFONT.open('wb') as f:
            for part in parts:f.write(part.read_bytes())
    if hashlib.sha256(SOUNDFONT.read_bytes()).hexdigest()!=FONT_SHA:raise ValueError('SoundFont SHA-256 mismatch.')
    WORK.mkdir(exist_ok=True);(WORK/'stems').mkdir(exist_ok=True)
    os.chdir(WORK)
    total=write_score();data=enrich_outputs(total)
    print('Sections:',[(s['name'],s['start_seconds'],s['end_seconds']) for s in data['sections']],flush=True)
    if args.score_only:return
    exe=build_renderer()
    def render_channel(ch):
        path=WORK/'stems'/f'ch{ch:02}.raw'
        subprocess.run([str(exe),str(SOUNDFONT),str(WORK/f'events_ch{ch:02}.txt'),str(path),str(total)],cwd=WORK,check=True)
        print('Rendered',ck.CHANNELS[ch]['name'],flush=True)
    with ThreadPoolExecutor(max_workers=max(1,min(args.workers,4))) as pool:list(pool.map(render_channel,ck.CHANNELS))
    result=subprocess.run([sys.executable,str(ENGINE/'mix_kit.py'),str(ROOT/'song.wav')],cwd=WORK,text=True,capture_output=True)
    (ROOT/'mix-log.txt').write_text(result.stdout+result.stderr)
    if result.returncode:raise RuntimeError(result.stderr)
    print(result.stdout,flush=True);shutil.copy2(WORK/'mix-report.json',ROOT/'mix-report.json')
if __name__=='__main__':main()
