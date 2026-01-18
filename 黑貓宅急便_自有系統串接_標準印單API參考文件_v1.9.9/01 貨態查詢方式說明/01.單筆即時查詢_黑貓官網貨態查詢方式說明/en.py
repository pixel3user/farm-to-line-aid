from pathlib import Path

p = Path("宅急便官網貨態查詢.txt")
raw = p.read_bytes()

for enc in ["cp950", "big5", "gbk", "shift_jis", "latin1"]:
    try:
        text = raw.decode(enc)
        print("\n=== ", enc, "===\n")
        print(text[:500])
    except UnicodeDecodeError:
        pass
