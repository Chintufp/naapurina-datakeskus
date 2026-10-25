"""Convert every sheet of an .xlsx workbook into JSON (list of rows, each a list of cell values).

Python 3 standard library only (zipfile + xml.etree). Run isolated:
    python -I scripts/data/xlsx2json.py data-raw/KL_Vuositaulukot_25.xlsx data-raw/KL_Vuositaulukot_25.json
The workbook is treated as data only: no formulas are evaluated, no macros are run.
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {
    'm': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'pr': 'http://schemas.openxmlformats.org/package/2006/relationships',
}


def col_index(ref):
    letters = re.match(r'[A-Z]+', ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def main(src, dst):
    out = {}
    with zipfile.ZipFile(src) as z:
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in root.findall('m:si', NS):
                shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
        wb = ET.fromstring(z.read('xl/workbook.xml'))
        rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        target = {r.get('Id'): r.get('Target') for r in rels.findall('pr:Relationship', NS)}
        for sh in wb.find('m:sheets', NS):
            name = sh.get('name')
            rid = sh.get('{%s}id' % NS['r'])
            path = target[rid].lstrip('/')
            if not path.startswith('xl/'):
                path = 'xl/' + path
            root = ET.fromstring(z.read(path))
            rows = []
            for row in root.iter('{%s}row' % NS['m']):
                cells = []
                for c in row.findall('m:c', NS):
                    idx = col_index(c.get('r'))
                    while len(cells) < idx:
                        cells.append(None)
                    t = c.get('t')
                    v = c.find('m:v', NS)
                    val = None
                    if t == 's' and v is not None:
                        val = shared[int(v.text)]
                    elif t == 'inlineStr':
                        val = ''.join(x.text or '' for x in c.iter('{%s}t' % NS['m']))
                    elif t == 'str' and v is not None:
                        val = v.text
                    elif v is not None and v.text is not None:
                        try:
                            f = float(v.text)
                            val = int(f) if f.is_integer() else f
                        except ValueError:
                            val = v.text
                    cells.append(val)
                rows.append(cells)
            out[name] = rows
    with open(dst, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False)
    print('sheets:', ', '.join('%s(%d rows)' % (k, len(v)) for k, v in out.items()))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
