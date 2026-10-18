"""Recover course photographs from the scanned pages, not whole-page thumbnails."""
import json
from pathlib import Path
import cv2
import fitz
import numpy as np
from prepare import ROOT, DATA, write_json

for file in sorted((DATA/'lessons').glob('*.json')):
    lesson=json.loads(file.read_text(encoding='utf-8'))
    doc=fitz.open(ROOT/lesson['source'])
    page=doc[lesson['sourcePages'][0]-1]
    pix=page.get_pixmap(matrix=fitz.Matrix(2,2))
    arr=np.frombuffer(pix.samples,dtype=np.uint8).reshape(pix.height,pix.width,pix.n)[:,:,:3]
    hsv=cv2.cvtColor(arr,cv2.COLOR_RGB2HSV)
    mask=cv2.inRange(hsv,np.array([0,65,30]),np.array([179,255,245]))
    # The colored vocabulary sidebar must not merge into the photograph.
    even=lesson['number'] in range(1,37) and (next((n[2] for n in (__import__('prepare').UPPER if lesson['volume']=='上' else __import__('prepare').LOWER) if n[0]==lesson['title']),2)%2==0)
    left,right=(99,336) if even else (82,314)
    mask[:260]=0
    mask[:,:left*2]=0
    mask[:,right*2:]=0
    original_mask=mask.copy()
    mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((17,17),np.uint8))
    contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    boxes=[cv2.boundingRect(c) for c in contours]
    boxes=[(x,y,w,h) for x,y,w,h in boxes if w>160 and h>100 and .5<w/h<3.8
           and np.count_nonzero(original_mask[y:y+h,x:x+w])/(w*h)>.23]
    if boxes:
        x,y,w,h=max(boxes,key=lambda b:b[2]*b[3])
        image=arr[max(0,y-4):y+h+4,max(0,x-4):x+w+4]
        dest=DATA/'covers'/f"{lesson['number']:02d}.jpg"
        cv2.imencode('.jpg',cv2.cvtColor(image,cv2.COLOR_RGB2BGR))[1].tofile(str(dest))
        lesson['cover']=f"/media/covers/{lesson['number']:02d}.jpg"
        print(lesson['id'],x,y,w,h,flush=True)
    else:
        lesson['cover']=None
    write_json(file,lesson)

catalog=json.loads((DATA/'catalog.json').read_text(encoding='utf-8'))
for item in catalog:
    lesson=json.loads((DATA/'lessons'/f"{item['id']}.json").read_text(encoding='utf-8'))
    item['cover']=lesson['cover']
write_json(DATA/'catalog.json',catalog)
