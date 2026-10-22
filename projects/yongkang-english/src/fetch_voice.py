"""Download only pinned, hash-verified voice data; never execute downloaded code."""
from pathlib import Path
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[1]
def main():
    records=json.loads((ROOT/'docs/tts-download-audit.json').read_text());target=ROOT/'models';target.mkdir(exist_ok=True)
    for r in records:
        if r['name'].endswith('.whl'):continue
        f=target/r['name']
        if not f.exists() or hashlib.sha256(f.read_bytes()).hexdigest()!=r['sha256']:
            part=f.with_name(f.name+'.part')
            subprocess.run(['curl','--fail','--location','--retry','2','--max-time','180',r['url'],'-o',str(part)],check=True)
            if hashlib.sha256(part.read_bytes()).hexdigest()!=r['sha256']:raise ValueError(f'Hash mismatch: {r["name"]}')
            part.replace(f)
        print('Verified:',r['name'])
if __name__=='__main__':main()
