"""Bake deterministic, animation-safe edge collapses for Console's CC0 head.

Usage: python3 tools/build_head_detail.py Console.html
Only head3DDetailData is replaced; the original model remains byte-for-byte intact.
Reduced faces refer to original source vertices, retaining every morph and blink.
"""
import collections
import heapq
import json
import math
import re
import sys
from pathlib import Path


def normal(face, positions):
    result = [0., 0., 0.]
    for i, a in enumerate(face):
        b = face[(i + 1) % len(face)]
        p, q = positions[a], positions[b]
        result[0] += (p[1] - q[1]) * (p[2] + q[2])
        result[1] += (p[2] - q[2]) * (p[0] + q[0])
        result[2] += (p[0] - q[0]) * (p[1] + q[1])
    return result


def face_edges(face):
    return [tuple(sorted((a, face[(i + 1) % len(face)]))) for i, a in enumerate(face)]


def build(data):
    points = data['vertices']
    faces = {i: list(f) for i, f in enumerate(data['faces'])}
    incident = [set() for _ in points]
    edge_counts = collections.Counter()
    for i, face in faces.items():
        for v in face:
            incident[v].add(i)
        edge_counts.update(face_edges(face))
    locked = {v for e, count in edge_counts.items() if count == 1 for v in e}
    # Preserve the lip opening, fast-moving eyelid rims and the symmetry seam.
    locked.update(i for i, (x, y, z) in enumerate(points)
                  if abs(x) < .001 or (abs(x) < .35 and -.67 < y < -.47 and z > .86))
    locked.update(entry[0] for target in data['blinks'] for entry in target
                  if math.sqrt(sum(x*x for x in entry[1:])) > .08)
    locked.update(data['landmarks'].values())
    poses = [points]
    for target in data['targets']:
        pose = [p[:] for p in points]
        for v, x, y, z in target:
            pose[v] = [pose[v][0] + x, pose[v][1] + y, pose[v][2] + z]
        poses.append(pose)
    blink_pose = [p[:] for p in points]
    for target in data['blinks']:
        for v, x, y, z in target:
            blink_pose[v] = [blink_pose[v][0] + x, blink_pose[v][1] + y, blink_pose[v][2] + z]
    poses.append(blink_pose)
    quadrics = [[0.] * 16 for _ in points]
    for face in faces.values():
        n = normal(face, points)
        length = math.sqrt(sum(x*x for x in n))
        if length < 1e-12:
            continue
        n = [x / length for x in n]
        plane = n + [-sum(n[k] * points[face[0]][k] for k in range(3))]
        q = [a*b for a in plane for b in plane]
        for v in face:
            quadrics[v] = [a+b for a, b in zip(quadrics[v], q)]
    revisions = [0] * len(points)
    heap = []

    def queue(a, b):
        if not incident[a] or not incident[b] or (a in locked and b in locked):
            return
        if data['materials'][a] != data['materials'][b]:
            return
        q = [x+y for x, y in zip(quadrics[a], quadrics[b])]
        def error(v):
            p = points[v] + [1.]
            return sum(q[i*4+j] * p[i] * p[j] for i in range(4) for j in range(4))
        keep = a if a in locked else b if b in locked else min((a, b), key=lambda v: (error(v), v))
        drop = b if keep == a else a
        # Penalize collapsing vertices that move differently during speech/blinking.
        motion = max(sum(((p[a][k]-points[a][k]) - (p[b][k]-points[b][k]))**2
                         for k in range(3)) for p in poses)
        cost = max(0., error(keep)) + motion * .05 + sum((points[a][k]-points[b][k])**2 for k in range(3)) * .0001
        heapq.heappush(heap, (cost, keep, drop, revisions[keep], revisions[drop]))

    for a, b in edge_counts:
        queue(a, b)
    levels = []
    for detail, target_count in [(75, 3500), (50, 2400), (25, 1500), (10, 1250)]:
        while len(faces) > target_count and heap:
            _, keep, drop, rk, rd = heapq.heappop(heap)
            if rk != revisions[keep] or rd != revisions[drop] or not edge_counts.get(tuple(sorted((keep, drop)))):
                continue
            affected = incident[keep] | incident[drop]
            replacements = {}
            changes = collections.Counter()
            valid = True
            for f in affected:
                old = faces[f]
                new = []
                for v in old:
                    v = keep if v == drop else v
                    if not new or new[-1] != v:
                        new.append(v)
                if len(new) > 1 and new[0] == new[-1]:
                    new.pop()
                if len(new) != len(set(new)):
                    valid = False
                    break
                if len(new) < 3:
                    new = []
                changes.subtract(face_edges(old))
                changes.update(face_edges(new))
                replacements[f] = new
                if new and drop in old:
                    for pose in poses:
                        before, after = normal(old, pose), normal(new, pose)
                        aa, bb = sum(x*x for x in before), sum(x*x for x in after)
                        if bb < 1e-16 or sum(a*b for a, b in zip(before, after)) < .15 * math.sqrt(aa*bb):
                            valid = False
                            break
                if not valid:
                    break
            if not valid or any(edge_counts[e] + count > 2 for e, count in changes.items()):
                continue
            # A single connected fan prevents pinched vertices and joined shells.
            link = collections.defaultdict(list)
            seen_faces = set()
            for new in replacements.values():
                if not new:
                    continue
                key = tuple(sorted(new))
                if key in seen_faces:
                    valid = False
                    break
                seen_faces.add(key)
                i = new.index(keep)
                a, b = new[i-1], new[(i+1) % len(new)]
                link[a].append(b)
                link[b].append(a)
            if not valid or any(len(n) > 2 for n in link.values()):
                continue
            reached = set()
            pending = [next(iter(link))] if link else []
            while pending:
                v = pending.pop()
                if v not in reached:
                    reached.add(v)
                    pending.extend(link[v])
            if len(reached) != len(link):
                continue
            for f in affected:
                for v in faces[f]:
                    incident[v].discard(f)
                new = replacements[f]
                if new:
                    faces[f] = new
                    for v in new:
                        incident[v].add(f)
                else:
                    del faces[f]
            edge_counts.update(changes)
            quadrics[keep] = [a+b for a, b in zip(quadrics[keep], quadrics[drop])]
            revisions[keep] += 1
            revisions[drop] += 1
            neighbors = {v for f in incident[keep] for v in faces[f] if v != keep}
            for v in neighbors:
                queue(keep, v)
        level = {'detail': detail, 'faces': list(faces.values())}
        levels.append(level)
        print(f"{detail}%: {len(faces)} polygons, {len({v for f in faces.values() for v in f})} vertices", flush=True)
    return {'method': 'Source-vertex quadric edge collapses; protected lips, eyelids, seams and boundaries; checked against all mouth targets and closed eyelids.', 'levels': levels}


if __name__ == '__main__':
    path = Path(sys.argv[1])
    html = path.read_text()
    model = json.loads(re.search(r'<script id="head3DModelData" type="application/json">(.*?)</script>', html, re.S)[1])
    result = build(model)
    tag = '<script id="head3DDetailData" type="application/json">' + json.dumps(result, separators=(',', ':')) + '</script>'
    if 'id="head3DDetailData"' in html:
        html = re.sub(r'<script id="head3DDetailData" type="application/json">.*?</script>', lambda _: tag, html, flags=re.S)
    else:
        html = html.replace('<script id="head3DModelData"', tag + '\n<script id="head3DModelData"', 1)
    path.write_text(html)
