"""Local speech, sentence timings and readable English captions from one script."""
from pathlib import Path
import json, wave, re, math, sys
import numpy as np
import onnxruntime as ort
ort.disable_telemetry_events()
from piper import PiperVoice, SynthesisConfig
from piper.config import PiperConfig

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'assets/audio'
FPS = 30
# These are English-reading approximations; subtitles retain standard place names.
PRONUNCIATION = {
    'Yongkang': '[[ jˈʊŋ kˈɑːŋ ]]',
    'Zhejiang': '[[ dʒə dʒˈjɑːŋ ]]',
    'Jinhua': '[[ dʒˈɪn hwˈɑː ]]',
    'Fangyan': '[[ fˈɑːŋ jˈɛn ]]',
    'Xijin': '[[ ʃˈiː dʒˈɪn ]]',
    'Zhiying': '[[ dʒˈɜː jˈɪŋ ]]',
    'roumaibing': '[[ ɹˌoʊ mˈaɪ bˌɪŋ ]]',
}
def timestamp(seconds, ass=False):
    ticks = round(seconds * (100 if ass else 1000))
    h, ticks = divmod(ticks, 360000 if ass else 3600000)
    m, ticks = divmod(ticks, 6000 if ass else 60000)
    s, sub = divmod(ticks, 100 if ass else 1000)
    return f'{h}:{m:02}:{s:02}.{sub:02}' if ass else f'{h:02}:{m:02}:{s:02},{sub:03}'
def lines(text, maximum=78):
    words = text.split()
    if len(text) <= maximum: return [text]
    # Balanced two-line subtitles, with no line longer than 78 characters.
    candidates = [(' '.join(words[:i]), ' '.join(words[i:])) for i in range(1,len(words))]
    a,b = min(candidates,key=lambda p:abs(len(p[0])-len(p[1]))+max(0,max(map(len,p))-maximum)*100)
    assert max(len(a),len(b)) <= maximum, text
    return [a,b]
def main():
    AUDIO.mkdir(parents=True, exist_ok=True)
    (ROOT/'output').mkdir(exist_ok=True)
    source = json.loads((ROOT/'src/narration.json').read_text())
    cfg = PiperConfig.from_dict(json.loads((ROOT/'models/en_US-ljspeech-high.onnx.json').read_text()))
    options=ort.SessionOptions(); options.intra_op_num_threads=2; options.inter_op_num_threads=1
    ort.set_seed(221026)
    voice=PiperVoice(config=cfg,session=ort.InferenceSession(str(ROOT/'models/en_US-ljspeech-high.onnx'),sess_options=options,providers=['CPUExecutionProvider']))
    rate=cfg.sample_rate; chunks=[np.zeros(round(3.4*rate),dtype=np.float32)]; position=len(chunks[0])/rate; timed=[]
    last_section=None
    for i, row in enumerate(source):
        if last_section is not None and row['section']!=last_section:
            gap=np.zeros(round(.35*rate),dtype=np.float32);chunks.append(gap);position+=len(gap)/rate
        speech=row['text']
        for name,phonemes in PRONUNCIATION.items():speech=re.sub(r'\b'+name+r'\b',phonemes,speech)
        audio=np.concatenate([c.audio_float_array for c in voice.synthesize(speech,syn_config=SynthesisConfig(length_scale=1.18,noise_scale=.58,noise_w_scale=.65,volume=.86))])
        signal=np.flatnonzero(np.abs(audio)>.008)
        if len(signal):audio=audio[max(0,signal[0]-int(.07*rate)):min(len(audio),signal[-1]+int(.13*rate))]
        assert len(audio)>rate*.25
        fade=min(int(.008*rate),len(audio)//4);audio[:fade]*=np.linspace(0,1,fade);audio[-fade:]*=np.linspace(1,0,fade)
        start=position;end=start+len(audio)/rate
        # Long sentences use phrase captions with exact clip boundaries, not guessed word times.
        timed.append({**row,'start':round(start,4),'end':round(end,4),'caption':lines(row['text']), 'tts_text':speech})
        chunks.append(audio);position=end
        silence=np.zeros(round(.31*rate),dtype=np.float32);chunks.append(silence);position+=len(silence)/rate
        last_section=row['section'];print(f'{i+1:02}/{len(source)} {row["section"]:12} {end-start:.2f}s',flush=True)
    spoken_end=position
    duration=math.ceil((position+8.5)*FPS)/FPS
    chunks.append(np.zeros(round((duration-position)*rate),dtype=np.float32))
    joined=np.concatenate(chunks)
    with wave.open(str(AUDIO/'narration.wav'),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes((np.clip(joined,-.999,.999)*32767).astype('<i2').tobytes())
    (AUDIO/'timeline.json').write_text(json.dumps({'fps':FPS,'duration':duration,'spoken_end':spoken_end,'segments':timed},indent=2,ensure_ascii=False)+'\n')
    (ROOT/'narration.txt').write_text('\n\n'.join(r['text'] for r in source)+'\n')
    srt='\n\n'.join(f'{i+1}\n{timestamp(r["start"])} --> {timestamp(r["end"])}\n'+ '\n'.join(r['caption']) for i,r in enumerate(timed))+'\n'
    (AUDIO/'subtitles.srt').write_text(srt)
    header='''[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Default,DejaVu Sans,36,&H00FFFFFF,&H000000FF,&H20120D0A,&H8A120D0A,0,0,0,0,100,100,0,0,3,11,0,2,100,100,48,1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n'''
    events=[]
    for r in timed:
        text=r'\N'.join(r['caption'])
        events.append(f'Dialogue: 0,{timestamp(r["start"],True)},{timestamp(r["end"],True)},Default,,0,0,0,,{{\\fad(90,90)}}{text}')
    (AUDIO/'captions.ass').write_text(header+'\n'.join(events)+'\n')
    print(f'Total {duration:.2f}s; narration {sum(r["end"]-r["start"] for r in timed):.2f}s; zero clipping {np.max(np.abs(joined))<1}',flush=True)
if __name__=='__main__': main()
