"""Retain every original usage/word-distinction page before a lesson's exercises."""
import json
import re
import fitz
from prepare import ROOT, DATA, write_json

for file in sorted((DATA/'lessons').glob('*.json')):
    l=json.loads(file.read_text(encoding='utf-8'))
    doc=fitz.open(ROOT/l['source'])
    start=l['grammarPages'][0]-1
    pages=[]
    for pi in range(start,min(start+7,len(doc))):
        page=doc[pi]
        found=[]
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines',[]):
                text=''.join(s['text'] for s in line['spans'])
                if re.search(r'Exercises|^练习\s*$',text,re.I):
                    found.append(line['bbox'][1])
        if found and min(found)<180:
            break
        pages.append(pi+1)
        out=DATA/'pages'/f"{'upper' if l['volume']=='上' else 'lower'}-{pi+1}.jpg"
        if not out.exists():
            page.get_pixmap(matrix=fitz.Matrix(1.8,1.8)).save(out)
        if found:
            break
    l['grammarPages']=pages
    write_json(file,l)
    print(l['id'],pages,flush=True)
