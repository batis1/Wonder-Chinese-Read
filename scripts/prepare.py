"""Extract the user's course books and annotate with the official 2025 HSK syllabus."""
import argparse
import gzip
import json
import re
import sys
import subprocess
import os
from pathlib import Path

import fitz
import jieba
from pypinyin import lazy_pinyin, Style
from pypinyin.contrib.tone_convert import to_tone

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
SYLLABUS = 'https://hsk.cn-bj.ufileos.com/3.0/新版HSK考试大纲（词汇、汉字、语法）.pdf'
HAN = re.compile(r'[\u3400-\u9fff]')

UPPER = [
 ('爱的细节','Details of Love',2), ('留串钥匙给父母','A Set of Keys for Our Parents',9),
 ('人生有选择，一切可改变','Choices Can Change Your Life',16), ('子路背米','Zilu Carries Rice',26),
 ('济南的泉水','The Springs of Jinan',34), ('除夕的由来','The Origin of New Year’s Eve',43),
 ('成语故事两则','Two Chinese Idiom Stories',54), ('“朝三暮四”的古今义','Three in the Morning, Four at Night',63),
 ('别样鲁迅','Another Side of Lu Xun',71), ('争论的奇迹','The Miracle of Debate',80),
 ('闹钟的危害','The Harm of Alarm Clocks',88), ('海外用户玩儿微信','WeChat Around the World',97),
 ('锯掉生活的“筐底”','Cutting the Bottom out of Life’s Basket',106), ('北京的四合院','Beijing Courtyard Homes',114),
 ('纸上谈兵','An Armchair Strategist',123), ('体重与节食','Weight and Diet',134),
 ('在最美好的时刻离开','Leaving at the Best Moment',142), ('抽象艺术美不美','Is Abstract Art Beautiful?',150),
]
LOWER = [
 ('家乡的萝卜饼','Radish Pancakes from My Hometown',2), ('小人书摊','The Picture Book Stall',10),
 ('汉字叔叔：一个美国人的汉字情缘','Uncle Hanzi: A Love for Chinese Characters',18), ('阅读与思考','Reading and Thinking',28),
 ('放手','Letting Go',35), ('支教行动','Volunteer Teaching',43), ('给自己加满水','Filling Your Own Glass',52),
 ('你属于哪一种“忙”','What Kind of Busy Are You?',59), ('下棋','A Game of Chess',67),
 ('最受欢迎的毕业生','The Most Popular Graduate',76), ('培养对手','Developing a Rival',84),
 ('竞争让市场更高效','Competition Makes Markets More Efficient',92), ('登门槛效应','The Foot-in-the-Door Effect',102),
 ('身边的环保','Environmental Protection Around Us',110), ('以堵治堵——缓解交通有妙招','A Clever Approach to Traffic',118),
 ('鸟儿的护肤术','How Birds Care for Their Feathers',128), ('植物会出汗','Plants Sweat Too',136),
 ('老舍与养花','Lao She and His Flowers',144),
]


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary=path.with_name(path.name+f'.{os.getpid()}.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    temporary.replace(path)


def lines(page):
    result = []
    for b in page.get_text('dict')['blocks']:
        for line in b.get('lines', []):
            spans = line['spans']
            result.append({'bbox': line['bbox'], 'text': ''.join(s['text'] for s in spans),
                           'size': max(s['size'] for s in spans)})
    return sorted(result, key=lambda l: (round(l['bbox'][1] / 3), l['bbox'][0]))


def positioned_lines(page, rect):
    chars=[]
    for block in page.get_text('rawdict')['blocks']:
        for line in block.get('lines',[]):
            for span in line['spans']:
                for char in span['chars']:
                    x0,y0,x1,y1=char['bbox']
                    if rect.x0<=(x0+x1)/2<=rect.x1 and rect.y0<=(y0+y1)/2<=rect.y1:
                        chars.append((x0,(y0+y1)/2,y0,x1,y1,char['c']))
    rows=[]
    for char in sorted(chars,key=lambda c:c[1]):
        if rows and abs(rows[-1][0]-char[1])<5:
            rows[-1][1].append(char)
        else:
            rows.append([char[1],[char]])
    result=[]
    for _,row in rows:
        row.sort(key=lambda c:c[0])
        text=''.join(c[5] for c in row)
        if len(HAN.findall(text))>1 and not re.search(r'改编自|选自|作者|标准教程|专有名词',text):
            result.append({'text':text,'bbox':(min(c[0] for c in row),min(c[2] for c in row),max(c[3] for c in row),max(c[4] for c in row))})
    return result


def dictionary():
    entries = {}
    with gzip.open(DATA / 'sources/cedict.txt.gz', 'rt', encoding='utf-8') as f:
        for line in f:
            m = re.match(r'^(\S+) (\S+) \[(.*?)\] /(.*)/$', line.strip())
            if not m:
                continue
            traditional, simplified, py, meanings = m.groups()
            item = entries.setdefault(simplified, {'traditional': traditional, 'definitions': [], 'pinyin': py})
            if '5' in py or ('surname ' not in meanings.lower() and 'surname ' in ';'.join(item['definitions']).lower()):
                item['pinyin'] = py
            item['definitions'].extend([x for x in meanings.split('/') if x not in item['definitions']][:8])
    return entries


def vocabulary():
    d = fitz.open(DATA / 'sources/hsk-2025.pdf')
    vocab = {}
    for page in list(d)[3:278]:
        # The official table contains an ID, level (including sense levels), word and pinyin.
        table = page.get_text()
        pattern = r'(?:^|\n)(\d{1,5})\s*\n([1-7](?:[—－–-]9)?(?:[（(][^\n]+[）)])*)\s*\n([^\n]+)\n([^\n]+)'
        for m in re.finditer(pattern, table):
            _, level, word, py = m.groups()
            word = re.sub(r'[0-9¹²³⁴]', '', word.strip())
            if HAN.search(word):
                item = {'level': int(level[0]), 'pinyin': py.strip(), 'sourceLevel': level}
                if word not in vocab or item['level'] < vocab[word]['level']:
                    vocab[word] = item
    if len(vocab) < 9000:
        raise ValueError(f'Official vocabulary extraction incomplete: {len(vocab)} words')
    return vocab


def annotations(text, lexicon, vocab):
    def split_word(word):
        if word in lexicon or word in vocab or len(word) < 2 or not HAN.search(word):
            return [word]
        result=[]
        i=0
        while i<len(word):
            best=next((word[i:j] for j in range(len(word),i,-1) if word[i:j] in vocab or word[i:j] in lexicon),word[i])
            result.append(best)
            i+=len(best)
        return result

    paragraphs = []
    for paragraph in text.split('\n'):
        if not paragraph.strip():
            continue
        sentences = []
        for s in re.findall(r'[^。！？!?]*[。！？!?]+[”」]?|[^。！？!?]+$', paragraph):
            tokens = []
            for w in [w for chunk in jieba.cut(s, HMM=False) for w in split_word(chunk)]:
                if not w.strip():
                    continue
                entry = lexicon.get(w, {})
                hsk = vocab.get(w, {})
                py=' '.join(lazy_pinyin(w, style=Style.TONE)) if HAN.search(w) else ''
                if len(w)>1 and entry.get('pinyin'):
                    py=' '.join(to_tone(x.lower().replace('u:','v')) for x in entry['pinyin'].split())
                if hsk.get('pinyin') and '/' not in hsk['pinyin']:
                    py=hsk['pinyin']
                if w=='地' and re.search(r'地(?:照顾|笑|从|说|看|走|写|做|拿)',s):
                    py='de'
                if w=='得' and re.search(r'得(?:听|去|做|说|等|先|把|想)',s):
                    py='děi'
                if w=='长' and '长时间' in s:
                    py='cháng'
                if w=='一行' and '一行字' in s:
                    py='yì háng'
                tokens.append({'text': w, 'pinyin': py,
                               'level': hsk.get('level'), 'meaning': '; '.join(entry.get('definitions', [])[:3]),
                               'traditional': entry.get('traditional', w)})
            sentences.append({'text': s, 'translation': '', 'tokens': tokens})
        paragraphs.append({'sentences': sentences})
    return paragraphs


def clean(text):
    return re.sub(r'\s+', '', text).replace('笫', '第').replace('巳', '已')


def extract_book(volume, lessons, use_ocr=False):
    doc = fitz.open(ROOT / f'HSK5{volume}.pdf')
    ocr = None
    if use_ocr:
        from rapidocr_onnxruntime import RapidOCR
        ocr = RapidOCR(intra_op_num_threads=4, inter_op_num_threads=2)
    output = []
    for index, (title, english, printed_page) in enumerate(lessons):
        number = index + (1 if volume == '上' else 19)
        existing = DATA / 'raw' / f'{number:02d}.json'
        if existing.exists() and json.loads(existing.read_text(encoding='utf-8')).get('extractionVersion') == 2 and len(json.loads(existing.read_text(encoding='utf-8'))['text'])>500:
            output.append(json.loads(existing.read_text(encoding='utf-8')))
            continue
        starts = [i for i, p in enumerate(doc) if re.search(rf'(?<!\d){number:02d}\s*[-－]\s*1(?!\d)', p.get_text())]
        title_starts = [i for i, p in enumerate(doc) if i > 13 and clean(title) in clean(p.get_text()[:500])]
        first = starts[0] if starts else title_starts[0] if title_starts else printed_page + 12
        last = first + (lessons[index+1][2] - printed_page if index+1 < len(lessons) else 8)
        paragraphs, source_pages, grammar_pages = [], [], []
        notes_found = False
        for pi in range(first, min(last, len(doc))):
            page = doc[pi]
            ls = lines(page)
            notes = [l for l in ls if ('注释' in l['text'] or 'Notes' in l['text']) and l['bbox'][0] < 160]
            if notes:
                note_y = min(l['bbox'][1] for l in notes)
            else:
                note_y = 759
            if notes_found or notes:
                grammar_pages.append(pi + 1)
            if notes_found:
                continue
            names=[l for l in ls if '专有名词' in l['text'] and l['bbox'][0]<320]
            passage_end=min([note_y]+[l['bbox'][1] for l in names])
            low = 75
            if pi == first:
                markers = [l for l in ls if re.search(rf'(?<!\d){number:02d}\s*[-－]\s*1(?!\d)', l['text'])]
                if not markers:
                    markers = [l for l in ls if '课文' in l['text']]
                if not markers:
                    markers = [l for l in ls if re.search(r'\bText\b',l['text'])]
                if not markers:
                    raise ValueError(f'No passage marker for lesson {number}')
                low = min(l['bbox'][3] for l in markers) + 1
            candidates = [l for l in ls if l['bbox'][0] > 75 and l['bbox'][0] < 320
                          and l['bbox'][2] < 338 and low < l['bbox'][1] < note_y - 3
                          and len(HAN.findall(l['text'])) > 1 and l['size'] >= 11.5]
            if not candidates and not ocr:
                if notes:
                    notes_found = True
                continue
            # Original OCR has occasional errors. Re-read only the passage column from the scan.
            if ocr:
                import numpy as np
                even = (printed_page + pi - first) % 2 == 0
                x0, x1 = (99, 336) if even else (82, 314)
                y0, y1 = low, min(passage_end - 3, 756)
                fallback = positioned_lines(page,fitz.Rect(x0,y0,x1,y1))
                pix = page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5), clip=fitz.Rect(x0, y0, x1, y1))
                arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
                result, _ = ocr(arr)
                if result:
                    candidates = [{'text': r[1], 'bbox': (r[0][0][0]/2.5 + x0, r[0][0][1]/2.5 + y0,
                                   r[0][2][0]/2.5 + x0, r[0][2][1]/2.5 + y0)} for r in result
                                  if len(HAN.findall(r[1])) > 1 and not re.search(r'改编自|选自|作者|标准教程|专有名词', r[1])]
                    candidates.sort(key=lambda l: l['bbox'][1])
                else:
                    candidates = []
                ocr_count=sum(len(HAN.findall(l['text'])) for l in candidates)
                native_count=sum(len(HAN.findall(l['text'])) for l in fallback)
                if ocr_count < native_count*.75:
                    candidates=fallback
            if not candidates:
                if notes:
                    notes_found = True
                continue
            source_pages.append(pi + 1)
            baseline = min(l['bbox'][0] for l in candidates)
            for l in candidates:
                s = clean(l['text'])
                if not s:
                    continue
                if not paragraphs or (l['bbox'][0] - baseline > 15 and len(s) > 5):
                    paragraphs.append(s)
                else:
                    paragraphs[-1] += s
            if notes:
                notes_found = True
        # Preserve the source grammar and examples; its PDF link is always available.
        note_text = []
        for pi in grammar_pages[:3]:
            note_text.append(doc[pi-1].get_text(sort=True))
            page_dir = DATA / 'pages'
            page_dir.mkdir(parents=True, exist_ok=True)
            doc[pi-1].get_pixmap(matrix=fitz.Matrix(1.8, 1.8)).save(page_dir / f"{'upper' if volume == '上' else 'lower'}-{pi}.jpg")
        text = '\n'.join(paragraphs)
        cover = DATA / 'covers' / f'{number:02d}.jpg'
        cover.parent.mkdir(parents=True, exist_ok=True)
        # Extract the actual textbook photograph, excluding masks and tiny decorative images.
        images = []
        for pi in range(first, min(first+3, len(doc))):
            for im in doc[pi].get_images(full=True):
                if im[2] > 250 and im[3] > 150:
                    images.append((im[2]*im[3], im[0]))
        if images:
            _, xref = max(images)
            pix = fitz.Pixmap(doc, xref)
            if pix.colorspace and pix.colorspace.n != 3:
                pix = fitz.Pixmap(fitz.csRGB, pix)
            pix.save(cover)
        audio = sorted(ROOT.rglob(f'{number:02d}-1.mp3'))
        if number == 7 and audio:
            second = sorted(ROOT.rglob('07-3.mp3'))[0]
            joined = DATA / 'audio' / '07-combined.mp3'
            joined.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(['ffmpeg','-y','-v','error','-i',str(audio[0]),'-i',str(second),
                            '-filter_complex','[0:a][1:a]concat=n=2:v=0:a=1[out]','-map','[out]',str(joined)], check=True)
            audio = [joined]
        lesson = {'id': f'course-{number:02d}', 'number': number, 'volume': volume, 'title': title, 'english': english,
                  'text': text, 'sourcePages': source_pages, 'grammarPages': grammar_pages[:3],
                  'grammarSource': '\n'.join(note_text), 'audio': str(audio[0].relative_to(ROOT)) if audio else None,
                  'cover': f'/media/covers/{number:02d}.jpg' if cover.exists() else None,
                  'alignmentStatus': 'pending', 'source': f'HSK5{volume}.pdf',
                  'extraction': 'rapidocr' if ocr else 'pdf-text', 'extractionVersion': 2}
        output.append(lesson)
        write_json(DATA / 'raw' / f'{number:02d}.json', lesson)
        print(f'Lesson {number:02d}: {len(HAN.findall(text))} characters, pages {source_pages}', flush=True)
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ocr', action='store_true')
    parser.add_argument('--annotate-only', action='store_true')
    args = parser.parse_args()
    if not args.annotate_only:
        extract_book('上', UPPER, args.ocr)
        extract_book('下', LOWER, args.ocr)
    lex = dictionary()
    vocab = vocabulary()
    for word in vocab:
        jieba.add_word(word, freq=max(jieba.get_FREQ(word) or 0,10))
    write_json(DATA / 'dictionary.json', lex)
    write_json(DATA / 'vocabulary.json', vocab)
    catalog = []
    for f in sorted((DATA / 'raw').glob('*.json')):
        lesson = json.loads(f.read_text(encoding='utf-8'))
        lesson['paragraphs'] = annotations(lesson['text'], lex, vocab)
        target = DATA / 'lessons' / f"{lesson['id']}.json"
        if target.exists():
            previous = json.loads(target.read_text(encoding='utf-8'))
            lesson['cover']=previous.get('cover')
            lesson['grammarPages']=previous.get('grammarPages',lesson['grammarPages'])
            if previous.get('text') == lesson['text']:
                # Transfer character intervals to the new word segmentation.
                old_chars=[]
                for p in previous['paragraphs']:
                    for s in p['sentences']:
                        for t in s['tokens']:
                            old_chars.extend([(t.get('start'),t.get('end'))]*sum(c.isalnum() for c in t['text']))
                offset=0
                for p in lesson['paragraphs']:
                    for s in p['sentences']:
                        for t in s['tokens']:
                            count=sum(c.isalnum() for c in t['text'])
                            hits=old_chars[offset:offset+count]
                            offset+=count
                            if hits and all(h[0] is not None for h in hits):
                                t.update(start=hits[0][0],end=hits[-1][1],timingConfidence='machine')
                        timed=[t for t in s['tokens'] if 'start' in t]
                        if timed:
                            s.update(start=timed[0]['start'],end=timed[-1]['end'])
                lesson.update({k: previous[k] for k in ['alignmentStatus','alignmentQuality'] if k in previous})
        write_json(target, lesson)
        catalog.append({k: lesson[k] for k in ['id','number','volume','title','english','cover','sourcePages','alignmentStatus']})
    write_json(DATA / 'catalog.json', catalog)
    write_json(DATA / 'provenance.json', {'vocabulary': {'name': 'HSK 3.0 · November 2025 syllabus', 'effective': '2026-07',
               'url': SYLLABUS, 'entries': len(vocab)}, 'dictionary': {'name': 'CC-CEDICT', 'license': 'CC BY-SA 4.0',
               'url': 'https://www.mdbg.net/chinese/dictionary?page=cc-cedict'}, 'course': 'User-supplied HSK Standard Course 5 上 / 下'})
    print(f'Prepared {len(catalog)} lessons, {len(vocab)} HSK entries, {len(lex)} dictionary entries.', flush=True)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
