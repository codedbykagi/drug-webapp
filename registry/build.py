import json, re
from collections import defaultdict
from rows import ROWS

# Composition strings only where the chemistry is well established. Left blank
# rather than guessed for the rest.
MATRIX = {
 "Marquis":"Formaldehyde in concentrated sulfuric acid",
 "Mecke":"Selenous acid in concentrated sulfuric acid",
 "Mandelin":"Ammonium vanadate in concentrated sulfuric acid",
 "Froehde":"Molybdic acid / sodium molybdate in concentrated sulfuric acid",
 "Liebermann":"Sodium nitrite in concentrated sulfuric acid",
 "Scott (Cobalt Thiocyanate)":"Cobalt(II) thiocyanate, with HCl and chloroform stages",
 "Simon's":"Sodium nitroprusside with acetaldehyde and sodium carbonate",
 "Ehrlich (Van Urk)":"4-dimethylaminobenzaldehyde in acid",
 "Duquenois-Levine":"Vanillin and acetaldehyde in ethanol, then HCl, then chloroform",
 "Dille-Koppanyi":"Cobalt(II) acetate with isopropylamine",
 "Zimmermann":"1,3-dinitrobenzene with potassium hydroxide",
 "Zwikker":"Copper sulfate with pyridine",
 "Chen's":"Copper sulfate with sodium hydroxide",
 "Nitric Acid":"Concentrated nitric acid",
 "Ferric Chloride":"Ferric chloride solution",
 "Dragendorff":"Potassium bismuth iodide",
 "Mayer's":"Potassium mercuric iodide",
 "FPN":"Ferric chloride with perchloric and nitric acid",
}

def seconds(t):
    if not t or t in ("N/A","Unconfirmed"): return None
    if t.lower().startswith("immediate"): return 0
    m = re.search(r'(\d+)\s*[-–]\s*(\d+)\s*min', t)
    if m: return int(m.group(2))*60
    m = re.search(r'(\d+)\s*min', t)
    if m: return int(m.group(1))*60
    m = re.search(r'(\d+)\s*[-–]\s*(\d+)\s*s', t)
    if m: return int(m.group(2))
    m = re.search(r'(\d+)\s*s', t)
    if m: return int(m.group(1))
    return None

NO_REACTION = ("no reaction","unconfirmed")
def is_null_result(name): return any(k in name.lower() for k in NO_REACTION)

# Resolve duplicates. Rules, in order:
#   1. A Verified row always beats an Unconfirmed one.
#   2. Where both are verified, prefer the row whose FIRST COLOUR is the reagent
#      blank ("Clear"), because that is the sheet's dominant convention (59 of
#      80 rows) and the before/after comparison depends on the two frames
#      meaning the same thing across every entry.
best = {}
dropped = []
for r in ROWS:
    key = (r[0], r[1])
    if key not in best:
        best[key] = r; continue
    cur = best[key]
    def rank(x): return (x[12] == "Verified", x[2].strip().lower() == "clear")
    if rank(r) > rank(cur):
        best[key] = r; dropped.append(cur)
    else:
        dropped.append(r)

reagents = defaultdict(list)
for r in best.values(): reagents[r[0]].append(r)

out = []
excluded = []
for name, rows in sorted(reagents.items()):
    states, negatives, blanks = [], [], set()
    for (_, sub, fname, fhex, lname, lhex, time, notes, org, doc, page, year, status) in sorted(rows, key=lambda x: x[1]):
        cite = f"{org} {doc[:44]}, p{page} ({year})" if org else "No published source located"
        if fname.strip().lower() == "clear" or "no reaction" in fname.lower():
            blanks.add(fhex)
        if status != "Verified":
            excluded.append((name, sub, "no source"));  continue
        if is_null_result(lname):
            negatives.append(sub)
            excluded.append((name, sub, "no colour change"))
            continue
        states.append({
            "label": lname, "analyte": sub, "hex": lhex.lower(),
            "atSeconds": seconds(time),
            "notes": f"{notes}. Source: {cite}. Colour value is an estimate from the written description, not a measurement.",
        })
    if not states: continue
    blank = "#e0e0e0" if "#E0E0E0" in blanks else ("#ffffff" if "#FFFFFF" in blanks else None)
    desc = []
    if negatives: desc.append("Documented non-reactions: " + ", ".join(sorted(set(negatives))) + ".")
    desc.append("All colour values are estimated from written descriptions in the cited sources. Replace with measured values before relying on a match.")
    out.append({
        "id": "rg-" + re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-'),
        "name": name,
        "chemicalMatrix": MATRIX.get(name, ""),
        "targetAnalytes": sorted({s["analyte"] for s in states}),
        "hexColor": states[0]["hex"],
        "reactionColor": states[0]["label"],
        "blankHex": blank,
        "nonReactive": sorted(set(negatives)),
        "colorStates": states,
        "description": " ".join(desc),
        "lotNumber": "", "expirationDate": "", "tempLimitC": "",
    })

json.dump(out, open("drugtrace-registry.json","w"), indent=2)
print(f"{len(out)} reagents, {sum(len(r['colorStates']) for r in out)} reference colours")
print(f"{len(dropped)} duplicate rows resolved, {len(excluded)} rows excluded from matching")
for e in excluded: print(f"   excluded: {e[0]} / {e[1]}  ({e[2]})")
