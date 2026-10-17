#!/usr/bin/env python3
"""Create reproducible local font subsets from the installed Noto CJK font set."""
import hashlib
import json
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'public/fonts'
DEST.mkdir(parents=True, exist_ok=True)
text = ''.join(chr(i) for i in range(32, 127)) + '士力架文明的底层代码生成识别演化回收静止图腾宗教几何星图徽章公式电路信息人类宇宙能量无素材全程序绘制源代码时间播放暂停秒分钟年月日倍速原始生命世界历史终点起点零一二三四五六七八九十，。；：？！—·×÷±∑∫∞→←↑↓⊕πθλΔΩμℏ√≈≤≥²³∂∇'
for directory in ['src', 'scripts']:
    for source in sorted((ROOT / directory).rglob('*')):
        if source.suffix in ['.ts', '.tsx', '.js', '.mjs', '.css', '.html']:
            text += source.read_text(encoding='utf-8')
for source in [ROOT / 'index.html']:
    if source.exists():
        text += source.read_text(encoding='utf-8')
codepoints = set(map(ord, text))
report = {'family': 'FilmSans', 'source': 'Noto Sans CJK SC, local system font, SIL Open Font License 1.1', 'fonts': []}
for weight in ['Regular', 'Bold']:
    source = Path(f'/usr/share/fonts/opentype/noto/NotoSansCJK-{weight}.ttc')
    if not source.exists():
        raise SystemExit(f'Install fonts-noto-cjk first: {source} missing. Existing bundled fonts do not require this script.')
    font = TTFont(str(source), fontNumber=2, recalcTimestamp=False)
    supported = set(font.getBestCmap())
    missing = sorted(n for n in codepoints - supported if n > 32 and not chr(n).isspace())
    options = subset.Options()
    options.layout_features = ['*']
    options.name_IDs = ['*']
    sub = subset.Subsetter(options=options)
    sub.populate(unicodes=sorted(codepoints & supported))
    sub.subset(font)
    for record in font['name'].names:
        value = {1: 'FilmSans', 2: weight, 4: f'FilmSans {weight}', 6: f'FilmSans-{weight}', 16: 'FilmSans', 17: weight}.get(record.nameID)
        if value:
            record.string = value.encode(record.getEncoding(), errors='replace')
    target = DEST / f'FilmSans-{weight}.ttf'
    font.save(target)
    font.flavor = 'woff2'
    web = DEST / f'FilmSans-{weight}.woff2'
    font.save(web)
    report['fonts'].append({'weight': weight, 'glyphs': len(font.getBestCmap()), 'missingSourceCharacters': ''.join(map(chr, missing)), 'ttfBytes': target.stat().st_size, 'woff2Bytes': web.stat().st_size, 'ttfSha256': hashlib.sha256(target.read_bytes()).hexdigest()})
(DEST / 'font-manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
for license_source in [Path('/usr/share/doc/fonts-noto-cjk/copyright'), Path('/usr/share/doc/fonts-noto/copyright')]:
    if license_source.exists():
        (DEST / 'LICENSE.txt').write_text(license_source.read_text(), encoding='utf-8')
        break
print(json.dumps(report, ensure_ascii=False, indent=2))
