"""Check scene-local references, authored clips and repair prop bindings."""
import json
import re
from pathlib import Path

import numpy as np
from scipy.io.wavfile import read
from check_scene import A, ROOT, V, load


def references(node):
    if isinstance(node, dict):
        if 'fileID' in node:
            yield node
        else:
            for value in node.values():
                yield from references(value)
    elif isinstance(node, list):
        for value in node:
            yield from references(value)


def guid(sidecar):
    return re.search(r'^guid: (\w+)$', sidecar.read_text(), flags=re.M).group(1)


def check():
    assets = {guid(p): Path(str(p)[:-5]) for p in A.rglob('*.meta')}
    scene_file = A / 'Scenes/StormWatch.unity'
    scene = load(scene_file)
    local_refs = [ref for _, node in scene.values() for ref in references(node)]
    for ref in local_refs:
        if ref['fileID'] and 'guid' not in ref:
            assert ref['fileID'] in scene, ref

    weather = next(node for _, node in scene.values() if 'rainMaterial' in node)
    clips = {}
    for name in ['wind', 'rain', 'ventilation', 'engine', 'thunder']:
        path = assets[weather[name]['guid']]
        rate, pcm = read(path)
        samples = pcm.astype(float) / 32768.
        peak = np.max(np.abs(samples))
        rms = np.sqrt(np.mean(samples ** 2))
        assert 0 < rms <= peak < 1 and pcm.dtype == np.int16
        clips[name] = {
            'path': path.relative_to(ROOT).as_posix(),
            'seconds': round(len(samples) / rate, 2),
            'peak_dbfs': round(float(20 * np.log10(peak)), 2),
            'rms_dbfs': round(float(20 * np.log10(rms)), 2),
        }
    triggers = sum(1 for p in (A / 'Prefabs').glob('*.prefab')
                   for kind, component in load(p).values()
                   if kind == 'BoxCollider' and component.get('m_IsTrigger'))
    assert triggers == 24
    build = load(ROOT / 'ProjectSettings/EditorBuildSettings.asset')
    assert build[1][1]['m_Scenes'][0]['guid'] == guid(Path(str(scene_file) + '.meta'))
    for kind in ('AudioListener', 'CharacterController'):
        assert sum(t == kind for t, _ in scene.values()) == 1
    report = dict(audio=clips, interaction_triggers=triggers,
                  scene_local_refs_checked=len(local_refs), build_entry_matches=True,
                  single_listener=True, unity_editor_tested=False, headset_tested=False)
    (V / 'Bindings.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f'Checked {len(local_refs)} references, {len(clips)} clips and {triggers} triggers.')


if __name__ == '__main__':
    check()
