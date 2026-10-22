"""Master narration/music, mux the final movie, and make a smaller 720p copy."""
from pathlib import Path
import json, subprocess, re, shutil
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output'; AUDIO=ROOT/'assets/audio'

def run(cmd):
    result=subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True)
    if result.returncode:
        print(result.stderr[-10000:],flush=True)
        raise RuntimeError('Media command failed: '+cmd[0])
    return result
def main():
    timeline=json.loads((AUDIO/'timeline.json').read_text());duration=timeline['duration']
    picture=OUT/'picture-1080p.mp4'
    if not picture.exists() and (OUT/'yongkang-english-1080p.mp4').exists():
        (OUT/'yongkang-english-1080p.mp4').rename(picture)
    voice=AUDIO/'narration.flac';music=AUDIO/'music-original.flac'
    if not voice.exists():voice=AUDIO/'narration.wav'
    if not music.exists():music=AUDIO/'music-original.wav'
    measure=run(['ffmpeg','-hide_banner','-i',str(voice),'-af','loudnorm=I=-17:TP=-2.5:LRA=8:print_format=json','-f','null','-'])
    match=re.findall(r'\{[^{}]*"input_i"[^{}]*\}',measure.stderr,re.S);stats=json.loads(match[-1]);(OUT/'narration-loudness.json').write_text(json.dumps(stats,indent=2)+'\n')
    norm=f'loudnorm=I=-17:TP=-2.5:LRA=8:measured_I={stats["input_i"]}:measured_TP={stats["input_tp"]}:measured_LRA={stats["input_lra"]}:measured_thresh={stats["input_thresh"]}:offset={stats["target_offset"]}:linear=true'
    graph=(f'[0:a]{norm},aresample=48000,asplit=2[v][side];'
           f'[1:a]aresample=48000,atrim=duration={duration},volume=0.82,afade=t=out:st={duration-5}:d=5[m];'
           '[m][side]sidechaincompress=threshold=0.04:ratio=2.3:attack=50:release=400[duck];'
           f'[v][duck]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89:level=false,afade=t=out:st={duration-.9}:d=0.9[a]')
    run(['ffmpeg','-hide_banner','-y','-i',str(voice),'-i',str(music),'-filter_complex',graph,'-map','[a]','-ar','48000','-ac','2','-c:a','pcm_s24le',str(OUT/'soundtrack.wav')])
    final=OUT/'Yongkang-An-English-City-Portrait-1080p.mp4'
    final_temp=final.with_name(final.stem+'.partial.mp4')
    comment=('English educational city portrait. Archival photos: Wikimedia Commons, individually credited; '
             'original graphics/music; local synthetic voice. Film CC BY-SA 4.0. Full credits/sources: '
             'https://github.com/xzsxhcs-gif/codex-deliverables/tree/main/projects/yongkang-english')
    run(['ffmpeg','-hide_banner','-y','-i',str(picture),'-i',str(OUT/'soundtrack.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-metadata','title=Yongkang — Made by Hand, Shaped by Time','-metadata','comment='+comment,'-t',str(duration),'-movflags','+faststart',str(final_temp)])
    final_temp.replace(final)
    small=OUT/'Yongkang-An-English-City-Portrait-720p.mp4'
    small_temp=small.with_name(small.stem+'.partial.mp4')
    run(['ffmpeg','-hide_banner','-y','-i',str(final),'-map','0:v:0','-map','0:a:0','-vf','scale=1280:720','-c:v','libx264','-preset','medium','-crf','23','-pix_fmt','yuv420p','-profile:v','main','-level:v','3.1','-threads','3','-c:a','aac','-b:a','128k','-metadata','title=Yongkang — English City Portrait (720p)','-metadata','comment='+comment,'-movflags','+faststart',str(small_temp)])
    small_temp.replace(small)
    shutil.copy2(AUDIO/'subtitles.srt',OUT/'Yongkang-English.srt')
    print('Final movie:',final.stat().st_size,'bytes; small copy:',small.stat().st_size,'bytes',flush=True)
if __name__=='__main__':main()
