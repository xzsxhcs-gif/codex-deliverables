"""Inspect the exported streams, sample alignment and cumulative arrangement."""
import hashlib, json, subprocess
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'render';QA=ROOT/'qa'; RATE=48000
def run(*parts):
    return subprocess.check_output(list(map(str,parts)))
def verify():
    movie=OUT/'shortwave.mp4'
    meta=json.loads(run('ffprobe','-v','error','-show_streams','-show_format','-of','json',movie))
    v,a=meta['streams']
    assert (v['codec_name'],v['width'],v['height'],v['pix_fmt'],v['avg_frame_rate'],int(v['nb_frames']))==('h264',1080,1920,'yuv420p','30/1',1140)
    assert a['codec_name']=='aac' and int(a['channels'])==2 and int(a['sample_rate'])==RATE
    assert all(abs(float(st['duration'])-38)<.001 and float(st['start_time'])==0 for st in [a,v])
    sr,master=wavfile.read(OUT/'master.wav'); y=master.astype(float)/32768.
    dec=np.frombuffer(run('ffmpeg','-v','error','-i',movie,'-map','0:a','-f','f32le','-'),'<f4').reshape(-1,2)
    assert len(dec)>=len(y)
    match=[float(np.corrcoef(dec[:len(y),ch],y[:,ch])[0,1]) for ch in (0,1)]
    assert min(match)>.975
    sections={}
    addition=np.zeros(master.shape,np.int32)
    levels={}
    for name,beat in [('FX',0),('DRUMS',0),('BASS',16),('SYNTH',32),('LEAD',48)]:
        sr,x=wavfile.read(OUT/'stems'/f'{name}.wav');assert len(x)==len(y) and sr==RATE
        idx=np.flatnonzero(np.abs(x.astype(np.int32)).max(axis=1)>5)
        first=idx[0]/RATE
        assert beat*60/124-.0001 <= first < beat*60/124 + (.55*60/124 if name=='SYNTH' else .06)
        sections[name]=round(first,4);addition+=x
        tail=x[int(RATE*31.3):int(RATE*36.5)].astype(float)/32768
        levels[name]=round(float(20*np.log10(np.sqrt(np.mean(tail**2)))),2)
    diff=int(np.abs(addition-master.astype(np.int32)).max());assert diff<=3
    run('ffmpeg','-v','error','-xerror','-i',movie,'-f','null','-')
    # Take five JPEGs from the finished encode and compare with authored reference frames.
    previews=[]
    for i,t in enumerate([2.4,10.4,19.4,26.7,33.3]):
        file=QA/f'encoded-{i+1}.jpg'
        run('ffmpeg','-v','error','-y','-ss',str(t),'-i',movie,'-frames:v',1,'-vf','scale=360:640','-q:v','2',file)
        img=Image.open(file).convert('RGB')
        reference=Image.open(QA/f'chapter-{i+1}.jpg').convert('RGB').resize(img.size,Image.Resampling.LANCZOS)
        error=np.abs(np.asarray(img).astype(float)-np.asarray(reference)).mean()
        assert error<12 and np.std(np.asarray(img))>32
        previews.append(round(error,2))
    report=dict(seconds=38,frames=1140,width=1080,height=1920,stereo_sample_rate=RATE,codecs=['h264','aac'],
        sha256=hashlib.sha256(movie.read_bytes()).hexdigest(),first_audible_seconds=sections,
        decoded_audio_correlation=match,pcm_reconstruction_max_lsb=diff,
        final_stage_stem_rms_dbfs=levels,encoded_still_mean_error_8bit=previews,full_decode=True)
    (QA/'verification.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(report))
if __name__=='__main__': verify()
