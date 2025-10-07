#!/usr/bin/env python3
"""
Extract cached MCP tool metadata from VS Code's SQLite state (state.vscdb).
- Works on a single file or scans a directory tree for all state.vscdb files.
- Outputs:
  * JSON report:  report_mcp_tools.json
  * CSV (if tools found): tools_mcp.csv
No external deps needed (stdlib only).
"""

import argparse, os, sqlite3, json, zlib, gzip, base64, re, csv
from pathlib import Path
from typing import Any, Dict, List, Tuple

KEY_HINTS = re.compile(r"(mcp|modelcontextprotocol|tools|toolcatalog|copilot)", re.I)

def looks_json(s: str) -> bool:
    s = s.strip()
    return (s.startswith("{") and s.endswith("}")) or (s.startswith("[") and s.endswith("]"))

def try_decode_blob(b: bytes) -> List[str]:
    outs: List[str] = []
    # direct text
    for enc in ("utf-8", "utf-16le", "latin1"):
        try:
            outs.append(b.decode(enc))
            break
        except Exception:
            pass
    # gzip
    try:
        outs.append(gzip.decompress(b).decode("utf-8", "ignore"))
    except Exception:
        pass
    # zlib (with/without header)
    for wbits in (zlib.MAX_WBITS, -zlib.MAX_WBITS):
        try:
            outs.append(zlib.decompress(b, wbits).decode("utf-8", "ignore"))
            break
        except Exception:
            pass
    # base64 → recurse
    if not outs:
        try:
            decoded = base64.b64decode(b, validate=True)
            outs.extend(try_decode_blob(decoded))
        except Exception:
            pass
    # unique, non-empty
    seen, uniq = set(), []
    for s in outs:
        if s and s not in seen:
            seen.add(s); uniq.append(s)
    return uniq

def safe_json_loads(s: str):
    try:
        return json.loads(s)
    except Exception:
        # try to remove trailing commas
        try:
            s2 = re.sub(r",\s*([}\]])", r"\1", s)
            return json.loads(s2)
        except Exception:
            return None

def json_find_tools(obj: Any) -> List[Dict[str, Any]]:
    """Walk arbitrary JSON and collect tool-like entries (name/description/schema)."""
    found: List[Dict[str, Any]] = []

    def is_tool(o: Any) -> bool:
        if not isinstance(o, dict): return False
        keys = {k.lower() for k in o.keys()}
        has_name = "name" in keys
        has_desc = "description" in keys or "desc" in keys
        has_schema = "input_schema" in keys or "inputschema" in keys or "schema" in keys
        return has_name and (has_desc or has_schema)

    def walk(o: Any):
        if isinstance(o, dict):
            for k, v in o.items():
                lk = k.lower()
                if lk in ("tools", "toolcatalog", "tool_catalog") and isinstance(v, list):
                    for item in v:
                        if is_tool(item):
                            found.append({
                                "name": item.get("name"),
                                "description": item.get("description") or item.get("desc"),
                                "schema": item.get("input_schema") or item.get("inputSchema") or item.get("schema")
                            })
                walk(v)
        elif isinstance(o, list):
            for x in o:
                walk(x)

    walk(obj)
    return found

def fetch_tables(conn: sqlite3.Connection) -> List[str]:
    cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    return [r[0] for r in cur.fetchall()]

def fetch_rows(conn: sqlite3.Connection, table: str) -> Tuple[List[str], List[Tuple[Any, ...]]]:
    cur = conn.execute(f"PRAGMA table_info({table})")
    cols = [r[1] for r in cur.fetchall()]
    rows = conn.execute(f"SELECT rowid, * FROM {table}").fetchall()
    return (["rowid"] + cols, rows)

def parse_db(db_path: Path) -> Dict[str, Any]:
    out = {"source": str(db_path), "tables": [], "hits": [], "tools": []}
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    except Exception as e:
        out["error"] = f"open_failed: {e}"
        return out

    try:
        tables = fetch_tables(conn)
        for t in tables:
            cols, rows = fetch_rows(conn, t)
            out["tables"].append({"name": t, "columns": cols, "row_count": len(rows)})

            for row in rows:
                row_map = dict(zip(cols, row))
                for col_name, val in row_map.items():
                    texts: List[str] = []
                    if isinstance(val, str):
                        texts = [val]
                    elif isinstance(val, bytes):
                        texts = try_decode_blob(val)
                    else:
                        continue

                    for text in texts:
                        if not text:
                            continue
                        if KEY_HINTS.search(text) or looks_json(text):
                            snippet = text
                            if len(snippet) > 600:
                                snippet = snippet[:500] + " … " + snippet[-80:]
                            out["hits"].append({
                                "table": t, "rowid": row_map.get("rowid"),
                                "column": col_name, "snippet": snippet
                            })
                            if looks_json(text):
                                obj = safe_json_loads(text)
                                if obj is not None:
                                    tools = json_find_tools(obj)
                                    if tools:
                                        out["tools"].extend(tools)
    finally:
        try: conn.close()
        except: pass

    # de-duplicate tools by (name, description)
    seen, uniq = set(), []
    for tool in out["tools"]:
        key = (str(tool.get("name")), str(tool.get("description")))
        if key not in seen:
            seen.add(key); uniq.append(tool)
    out["tools"] = uniq
    return out

def find_vscdb_files(root: Path) -> List[Path]:
    root = root.expanduser()
    if root.is_file() and root.name == "state.vscdb":
        return [root]
    matches: List[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        # prune obvious heavy dirs
        dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules", "__pycache__", ".venv", "venv")]
        for fn in filenames:
            if fn == "state.vscdb":
                matches.append(Path(dirpath) / fn)
    return matches

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--path", required=True, help="Path to a state.vscdb file OR a directory to scan")
    ap.add_argument("--out-json", default="report_mcp_tools.json")
    ap.add_argument("--out-csv", default="tools_mcp.csv")
    args = ap.parse_args()

    path = Path(os.path.expanduser(args.path))
    dbs = find_vscdb_files(path) if path.exists() and (path.is_dir() or path.name != "state.vscdb") else [path]
    dbs = [p for p in dbs if p.exists()]

    aggregate = {"reports": [], "total_tools": 0}
    tool_rows: List[Dict[str, Any]] = []

    for db in dbs:
        rep = parse_db(db)
        aggregate["reports"].append(rep)
        for t in rep.get("tools", []):
            tr = {"source": rep["source"], "name": t.get("name"), "description": t.get("description")}
            # flatten schema (short)
            schema = t.get("schema")
            tr["schema"] = json.dumps(schema)[:2000] if schema is not None else None
            tool_rows.append(tr)

    aggregate["total_tools"] = len(tool_rows)
    with open(args.out_json, "w", encoding="utf-8") as f:
        json.dump(aggregate, f, indent=2, ensure_ascii=False)

    if tool_rows:
        # write a simple CSV (name, description, schema, source)
        with open(args.out_csv, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["name","description","schema","source"])
            w.writeheader(); w.writerows(tool_rows)

    print(f"[✓] scanned {len(dbs)} database(s)")
    print(f"[i] total tools extracted: {aggregate['total_tools']}")
    print(f"[→] JSON: {args.out_json}")
    if tool_rows:
        print(f"[→] CSV : {args.out_csv}")
    else:
        print("[i] no explicit tool catalogs found; inspect JSON 'reports[*].hits' for promising blobs/keys")

if __name__ == "__main__":
    main()
