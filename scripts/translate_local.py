"""Persistent local Chinese-to-English translator using the Marian OPUS model."""
import json
import sys
from pathlib import Path
import torch
from transformers import MarianMTModel, MarianTokenizer

torch.set_num_threads(4)
root=Path(__file__).resolve().parents[1]
model_path=root/'.cache/translator'
tokenizer=MarianTokenizer.from_pretrained(str(model_path),local_files_only=True)
model=MarianMTModel.from_pretrained(str(model_path),local_files_only=True)
model.eval()
sys.stdout.reconfigure(encoding='utf-8')
print(json.dumps({'ready':True}),flush=True)
for line in sys.stdin:
    try:
        request=json.loads(line)
        text=request['text']
        chunks=[text[i:i+350] for i in range(0,len(text),350)]
        translated=[]
        for chunk in chunks:
            inputs=tokenizer(chunk,return_tensors='pt',truncation=True,max_length=512)
            with torch.inference_mode():
                output=model.generate(**inputs,max_new_tokens=256,num_beams=3)
            translated.append(tokenizer.decode(output[0],skip_special_tokens=True))
        print(json.dumps({'id':request['id'],'translation':' '.join(translated)},ensure_ascii=False),flush=True)
    except Exception as error:
        print(json.dumps({'id':request.get('id'),'error':str(error)}),flush=True)
