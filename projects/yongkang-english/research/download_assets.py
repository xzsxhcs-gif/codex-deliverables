"""Restore cleared Commons photographs from the reviewed manifest, with SHA-256 checks."""
from pathlib import Path
import argparse
import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
CONTACT = 'YongkangEducationalFilm/1.0 (https://github.com/xzsxhcs-gif/codex-deliverables)'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ids', help='Optional comma-separated IDs from research/assets.json')
    args = parser.parse_args()
    selected = set(args.ids.split(',')) if args.ids else None
    assets = json.loads((ROOT / 'research/assets.json').read_text())['assets']
    for item in assets:
        if selected is not None and item['id'] not in selected:
            continue
        if not item['approved']:
            raise ValueError('Unreviewed asset')
        target = (ROOT / item['path']).resolve()
        if not target.is_relative_to((ROOT / 'assets/photos').resolve()):
            raise ValueError('Unexpected asset destination')
        url = urllib.parse.urlparse(item['download_url'])
        if url.scheme != 'https' or url.hostname != 'upload.wikimedia.org':
            raise ValueError('Unexpected asset host')
        if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == item['sha256']:
            print('Verified existing:', item['id'], flush=True)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        for attempt in range(3):
            try:
                request = urllib.request.Request(item['download_url'], headers={'User-Agent': CONTACT})
                with urllib.request.urlopen(request, timeout=60) as response:
                    payload = response.read()
                if len(payload) != item['bytes'] or hashlib.sha256(payload).hexdigest() != item['sha256']:
                    raise ValueError('Source changed or download is incomplete: ' + item['id'])
                target.write_bytes(payload)
                print('Downloaded and verified:', item['id'], flush=True)
                break
            except urllib.error.HTTPError as error:
                if error.code not in (429, 503) or attempt == 2:
                    raise
                delay = min(60, int(error.headers.get('Retry-After', 20)))
                print('Rate limited; waiting', delay, 'seconds', flush=True)
                time.sleep(delay)
        time.sleep(3)


if __name__ == '__main__':
    main()
