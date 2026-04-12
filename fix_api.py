import os, re

for root, dirs, filenames in os.walk('frontend/src'):
    dirs[:] = [d for d in dirs if d != 'node_modules']
    for filename in filenames:
        if not filename.endswith(('.jsx', '.js')): continue
        path = os.path.join(root, filename)
        with open(path, encoding='utf-8') as f:
            content = f.read()
        new = re.sub(r"(api\.\w+\()`/(?!api/)([^`])", r"\1`/api/\2", content)
        new = re.sub(r"(api\.\w+\()'/(?!api/)([^'`])", r"\1'/api/\2", new)
        if new != content:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new)
            print(f"✓ {path}")
print("done")
