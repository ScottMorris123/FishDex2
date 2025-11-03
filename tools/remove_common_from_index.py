import json, os, sys, datetime

ROOT = r"d:\VSCode Projects\FishDex2"
INDEX_PATH = os.path.join(ROOT, 'data', 'index.json')
BACKUP_PATH = os.path.join(ROOT, 'data', f"index.backup.before_remove_common.{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}.json")


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    try:
        return json.loads(text)
    except Exception as e:
        print(f"ERROR: Failed to parse JSON at {path}: {e}")
        sys.exit(1)


def save_json(path, data):
    # Preserve compact-ish formatting but still readable
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)


def strip_common_from_item(item):
    if not isinstance(item, dict):
        return item
    # Remove any key containing the substring 'common' (case-insensitive)
    to_delete = [k for k in list(item.keys()) if 'common' in k.lower()]
    for k in to_delete:
        del item[k]
    return item


def main():
    if not os.path.exists(INDEX_PATH):
        print(f"ERROR: index.json not found at {INDEX_PATH}")
        sys.exit(1)

    data = load_json(INDEX_PATH)

    # Back up original file
    try:
        with open(BACKUP_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        print(f"Backed up original to {BACKUP_PATH}")
    except Exception as e:
        print(f"WARNING: could not create backup: {e}")

    # Find the array of items
    items = None
    container = None
    container_key = None

    if isinstance(data, list):
        items = data
        container = data
    elif isinstance(data, dict):
        if isinstance(data.get('items'), list):
            items = data['items']
            container = data
            container_key = 'items'
        elif isinstance(data.get('species'), list):
            items = data['species']
            container = data
            container_key = 'species'

    if items is None:
        print("ERROR: Could not locate items array in index.json (expected list, or dict with 'items' or 'species').")
        sys.exit(1)

    print(f"Found {len(items)} items; removing any keys containing 'common'...")

    cleaned = []
    changed = 0
    for it in items:
        if isinstance(it, dict):
            before_keys = set(it.keys())
            strip_common_from_item(it)
            after_keys = set(it.keys())
            if before_keys != after_keys:
                changed += 1
        cleaned.append(it)

    if isinstance(data, list):
        data = cleaned
    else:
        data[container_key] = cleaned

    save_json(INDEX_PATH, data)
    print(f"Wrote cleaned index to {INDEX_PATH}; changed {changed} items.")


if __name__ == '__main__':
    main()
