import json, os, sys, re, glob
from collections import defaultdict

ROOT = r"d:\VSCode Projects\FishDex2"
DATA = os.path.join(ROOT, 'data')
INDEX = os.path.join(DATA, 'index.json')
FLAGS = os.path.join(DATA, 'species_habitat_flags.json')
FAM_DIR = os.path.join(DATA, 'game_family_json')

CATS = ['game','commercial','bait']
WATERS = ['fresh','brackish','salt']
CATEGORY_FLAG = {'game':'gamefish', 'commercial':'commercial', 'bait':'bait'}

TRUTHY = {True, 1, '1', 'true', 'TRUE', 'Y', 'y', 'yes', 'Yes'}

def tval(v):
    if isinstance(v, str):
        v = v.strip()
    return v in TRUTHY


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        txt = f.read()
    return json.loads(txt) if txt.strip() else None


def iter_index_items():
    data = load_json(INDEX)
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        if isinstance(data.get('items'), list):
            items = data['items']
        elif isinstance(data.get('species'), list):
            items = data['species']
        else:
            items = []
    else:
        items = []
    seen = set()
    for it in items:
        code = str(it.get('spec_code') or it.get('SpecCode') or it.get('code') or it.get('id') or '').strip()
        if not code or code in seen:
            continue
        seen.add(code)
        yield it


def build_genus_common_map():
    genus_common = {}
    files = glob.glob(os.path.join(FAM_DIR, '*.json'))
    for fp in files:
        try:
            fam = load_json(fp)
            gens = fam.get('genera', []) if isinstance(fam, dict) else []
            for ge in gens:
                gsci = str(ge.get('scientific','')).strip()
                gcom = str(ge.get('common','')).strip()
                if gsci and gcom and gsci not in genus_common:
                    genus_common[gsci] = gcom
        except Exception:
            pass
    return genus_common


def get_genus(it):
    sci = str(it.get('scientific_name') or it.get('SciName') or it.get('sciname') or '').strip()
    if ' ' in sci:
        return sci.split()[0]
    return ''


def get_importances(it):
    val = it.get('importances') or it.get('importance') or it.get('usages') or it.get('usage') or it.get('interests') or it.get('interest')
    if not val:
        return []
    if isinstance(val, list):
        arr = [str(x).lower().strip() for x in val]
    else:
        s = str(val)
        arr = [x.strip().lower() for x in re.split(r'[|,;]', s) if x.strip()]
    canon = {'game':'game','gamefish':'game','game fish':'game','sport':'game','sports':'game','sportfish':'game','sport fish':'game','recreational':'game','angler':'game','angling':'game',
             'commercial':'commercial','commercial fish':'commercial','commercially important':'commercial','commercially-important':'commercial','food':'commercial','market':'commercial',
             'bait':'bait','baitfish':'bait','bait fish':'bait'}
    return list({canon.get(x,x) for x in arr})


def get_waters_from_index(it):
    raw = it.get('water_types') or it.get('water_type') or it.get('water') or it.get('habitats') or it.get('habitat')
    if not raw:
        return []
    if isinstance(raw, list):
        arr = [str(x).lower().strip() for x in raw]
    else:
        arr = [x.strip().lower() for x in re.split(r'[|,;]', str(raw)) if x.strip()]
    syn = {'fresh':'fresh','freshwater':'fresh','salt':'salt','saltwater':'salt','brackish':'brackish'}
    arr = [syn.get(w,w) for w in arr]
    return [w for w in {'fresh','brackish','salt'} if w in arr]


def main():
    flags_data = load_json(FLAGS) or []
    rows = flags_data if isinstance(flags_data, list) else flags_data.get('rows', [])
    flags_map = {}
    for r in rows:
        k = str(r.get('SpecCode') or r.get('spec_code') or r.get('code') or '').strip()
        if k:
            flags_map[k] = r

    genus_common = build_genus_common_map()

    buckets = {(c,w): defaultdict(lambda: {'genera': set(), 'codes': set()}) for c in CATS for w in WATERS}

    for it in iter_index_items():
        code = str(it.get('spec_code') or it.get('SpecCode') or it.get('code') or it.get('id') or '').strip()
        if not code:
            continue
        genus = get_genus(it)
        if not genus:
            continue
        label = genus_common.get(genus)
        if not label:
            continue
        row = flags_map.get(code)
        if row:
            for c in CATS:
                cf = CATEGORY_FLAG[c]
                if not tval(row.get(cf)):
                    continue
                for w in WATERS:
                    if tval(row.get('water_'+w)):
                        b = buckets[(c,w)][label]
                        b['genera'].add(genus)
                        b['codes'].add(code)
        else:
            uses = get_importances(it)
            waters = set(get_waters_from_index(it))
            for c in CATS:
                if c not in uses:
                    continue
                for w in WATERS:
                    if w in waters:
                        b = buckets[(c,w)][label]
                        b['genera'].add(genus)
                        b['codes'].add(code)

    # write files
    out_files = []
    for c in CATS:
        for w in WATERS:
            d = buckets[(c,w)]
            types = []
            for label, rec in d.items():
                types.append({
                    'label': label,
                    'genera': sorted(rec['genera']),
                    'codes': sorted(rec['codes'])
                })
            types.sort(key=lambda x: x['label'])
            out = {
                'version': 1,
                'category': c,
                'water': w,
                'types': types
            }
            out_path = os.path.join(DATA, f'fast_types.{c}.{w}.json')
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(out, f, ensure_ascii=False)
            out_files.append(out_path)
    print('Wrote:', *out_files, sep='\n - ')

if __name__ == '__main__':
    main()
