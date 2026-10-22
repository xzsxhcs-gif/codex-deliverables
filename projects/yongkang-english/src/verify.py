"""Validate actual deliverables, provenance and caption timing; write JSON evidence."""
from pathlib import Path
import hashlib,json,subprocess,struct,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output'
def probe(path):return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(path)]))
def atoms(path):
    result=[]
    with path.open('rb') as f:
        while True:
            at=f.tell();header=f.read(8)
            if len(header)<8:break
            size,kind=struct.unpack('>I4s',header)
            if size==1:size=struct.unpack('>Q',f.read(8))[0]
            if size==0:size=path.stat().st_size-at
            assert size>=8
            result.append(kind.decode('ascii'));f.seek(at+size)
    return result
def main():
    timeline=json.loads((ROOT/'assets/audio/timeline.json').read_text());checks=[]
    for suffix,size in [('1080p',(1920,1080)),('720p',(1280,720))]:
        file=OUT/f'Yongkang-An-English-City-Portrait-{suffix}.mp4';data=probe(file)
        video=next(s for s in data['streams'] if s['codec_type']=='video');audio=next(s for s in data['streams'] if s['codec_type']=='audio')
        assert video['codec_name']=='h264' and video['pix_fmt']=='yuv420p'
        assert (video['width'],video['height'])==size and video['avg_frame_rate']=='30/1'
        assert int(video['nb_frames'])==round(timeline['duration']*30)
        assert audio['codec_name']=='aac' and audio['channels']==2 and audio['sample_rate']=='48000'
        assert abs(float(data['format']['duration'])-timeline['duration'])<.08
        a=atoms(file);assert a.index('moov')<a.index('mdat')
        decode=subprocess.run(['ffmpeg','-v','error','-i',str(file),'-map','0:v:0','-map','0:a:0','-f','null','-'],text=True,capture_output=True)
        assert decode.returncode==0 and not decode.stderr,decode.stderr
        checks.append({'file':file.name,'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'width':video['width'],'height':video['height'],'fps':30,'frames':int(video['nb_frames']),'duration':float(data['format']['duration']),'videoCodec':video['codec_name'],'pixelFormat':video['pix_fmt'],'audioCodec':audio['codec_name'],'channels':audio['channels'],'sampleRate':48000,'fastStart':True,'completeDecodePassed':True})
    previous=0
    for row in timeline['segments']:
        assert 0<=previous<=row['start']<row['end']<=timeline['duration']
        assert 1<=len(row['caption'])<=2 and max(map(len,row['caption']))<=78
        previous=row['end']
    source=json.loads((ROOT/'research/assets.json').read_text());used=json.loads((OUT/'used-assets.json').read_text())
    for r in source['assets']:
        assert r['approved'] and hashlib.sha256((ROOT/r['path']).read_bytes()).hexdigest()==r['sha256']
    raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(OUT/'soundtrack.wav'),'-f','f32le','-acodec','pcm_f32le','-'])
    signal=np.frombuffer(raw,dtype='<f4');peak=float(np.abs(signal).max());assert peak<.999
    end=subprocess.check_output(['ffmpeg','-v','error','-sseof','-0.035','-i',str(OUT/'Yongkang-An-English-City-Portrait-1080p.mp4'),'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'])
    assert np.frombuffer(end,dtype=np.uint8).mean()<14
    report={'status':'passed','movies':checks,'captionCount':len(timeline['segments']),'captionsWithinAudioTimeline':True,'sourcePhotosHashVerified':len(source['assets']),'usedPhotoCount':len(used),'soundtrackPeak':peak,'noDigitalClipping':True,'lastFrameNearBlack':True,'factualReview':'docs/EDITORIAL-REVIEW.md','humanListeningReview':'not performed','cost':'No paid API or billable cloud generation used'}
    (OUT/'verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()
