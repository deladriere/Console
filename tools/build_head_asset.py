"""Extract the CC0 MakeHuman head and Microsoft's 22 visemes from upstream data.

Usage: python3 tools/build_head_asset.py --base base.obj --visemes visemes01.zip --faceunits faceunits01.zip --output head.json
Sources and checksums are documented in README and embedded in the generated asset.
This converter is original Console code; no MakeHuman application code is used.
"""
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

REVISION = 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482'
MESH_SHA256 = '8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c'
VISEME_SHA256 = 'f61f4f36bb4fe43486efa2a644eea9d6760e510bde10eecc97a4ddf28424e4d3'


FACEUNIT_SHA256 = 'd113107bd7eb59f3af4df6fc0ec29bfcc593f496d0b336aec14f086a80ce7146'


def build(base, visemes, faceunits):
    if hashlib.sha256(faceunits.read_bytes()).hexdigest() != FACEUNIT_SHA256:
        raise ValueError('Unexpected eyelid target pack; use the checksum in provenance.json.')
    if hashlib.sha256(base.read_bytes()).hexdigest() != MESH_SHA256:
        raise ValueError('Unexpected mesh revision; use the pinned source linked in README.')
    if hashlib.sha256(visemes.read_bytes()).hexdigest() != VISEME_SHA256:
        raise ValueError('Unexpected target pack; use the source and checksum in README / provenance.json.')
    vertices, polygons, group = [], [], ''
    for line in base.read_text().splitlines():
        parts = line.split()
        if not parts:
            continue
        if parts[0] == 'v':
            vertices.append(list(map(float, parts[1:4])))
        elif parts[0] == 'g':
            group = parts[1]
        elif parts[0] == 'f':
            polygons.append((group, [int(v.split('/')[0])-1 for v in parts[1:]]))
    allowed = {'body', 'helper-l-eye', 'helper-r-eye', 'helper-upper-teeth', 'helper-lower-teeth', 'helper-tongue'}
    selected = [(group, ids) for group, ids in polygons if group in allowed and all(vertices[i][1] > 5.7 for i in ids)]
    faces = [ids for group, ids in selected]
    part_ids = {'body':0,'helper-l-eye':1,'helper-r-eye':1,'helper-upper-teeth':2,'helper-lower-teeth':2,'helper-tongue':3}
    materials = {i:part_ids[group] for group, ids in selected for i in ids}
    original_ids = sorted({i for face in faces for i in face})
    remap = {old: new for new, old in enumerate(original_ids)}
    # Translation only: preserve the artist's anatomical proportions and topology.
    points = [[round(vertices[i][0],5), round(vertices[i][1]-7.2,5), round(vertices[i][2]-.55,5)] for i in original_ids]
    targets = [None]*22
    with zipfile.ZipFile(visemes) as archive:
        metadata = json.loads(archive.read('packs/visemes01.json'))
        assert len(metadata) == 22 and all(x['license'] == 'CC0' for x in metadata.values())
        for filename in archive.namelist():
            if not filename.endswith('.target'):
                continue
            index = int(re.search(r'_(\d+)\.target$', filename)[1])
            target = []
            for line in archive.read(filename).decode().splitlines():
                parts = line.split()
                if len(parts) == 4 and not line.startswith('#'):
                    old_id = int(parts[0])
                    if old_id in remap:
                        target.append([remap[old_id], *map(float, parts[1:])])
            targets[index] = target
    assert all(target is not None for target in targets)
    blinks = []
    with zipfile.ZipFile(faceunits) as archive:
        metadata = json.loads(archive.read('packs/faceunits01.json'))
        for name in ['eyeBlinkLeft', 'eyeBlinkRight']:
            assert metadata[name]['license'] == 'CC0'
            target = []
            for line in archive.read('targets/faceunits/'+name+'.target').decode().splitlines():
                parts = line.split()
                if len(parts) == 4 and not line.startswith('#') and int(parts[0]) in remap:
                    target.append([remap[int(parts[0])], *map(float, parts[1:])])
            blinks.append(target)
    return {
        'meta': {
            'name': 'MakeHuman hm08 head', 'license': 'CC0-1.0',
            'meshAuthor': 'MakeHuman Community', 'visemeAuthor': 'Mika Suominen',
            'revision': REVISION,
            'meshURL': f'https://raw.githubusercontent.com/makehumancommunity/makehuman/{REVISION}/makehuman/data/3dobjs/base.obj',
            'visemeURL': 'https://files.makehumancommunity.org/functional/visemes01.zip',
            'blinkAuthor': 'Mika Suominen',
            'blinkURL': 'https://files.makehumancommunity.org/functional/faceunits01.zip',
            'blinkSHA256': FACEUNIT_SHA256,
            'licenseURL': 'https://static.makehumancommunity.org/about/license.html',
            'meshSHA256': hashlib.sha256(base.read_bytes()).hexdigest(),
            'visemeSHA256': hashlib.sha256(visemes.read_bytes()).hexdigest(),
            'modifications': 'Head/neck crop at y > 5.7, head-only source vertex remapping, translation (0,-7.2,-0.55); no facial reshaping.',
        },
        'vertices': points,
        'materials': [materials[i] for i in original_ids],
        'faces': [[remap[i] for i in face] for face in faces],
        'targets': targets,
        'blinks': blinks,
        'sourceVertexIDs': original_ids,
        'landmarks': {'upperLip': remap[466], 'lowerLip': remap[494]},
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ['base', 'visemes', 'faceunits', 'output']:
        parser.add_argument('--'+arg, type=Path, required=True)
    args = parser.parse_args()
    result = build(args.base, args.visemes, args.faceunits)
    args.output.write_text(json.dumps(result, separators=(',', ':')))
    print(f"Extracted {len(result['vertices'])} vertices, {len(result['faces'])} faces and {len(result['targets'])} source visemes.")
