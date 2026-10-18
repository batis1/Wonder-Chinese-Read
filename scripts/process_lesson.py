"""Local passage annotation and Whisper forced alignment. No audio is uploaded."""
import argparse
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

from prepare import ROOT, DATA, annotations, write_json


def path_for(lesson_id):
    return DATA / ('lessons' if lesson_id.startswith('course-') else 'uploads') / f'{lesson_id}.json'


def canonical(text):
    return ''.join(c.lower() for c in text if c.isalnum())


def align(lesson, model):
    title = lesson['title'] if lesson['id'].startswith('course-') else ''
    transcript = (title + '。\n' if title else '') + lesson['text']
    result = model.align(str(ROOT / lesson['audio']), transcript, language='zh',
                         original_split=True, regroup=False, verbose=False, fast_mode=False,
                         token_step=100, suppress_silence=True, nonspeech_skip=5.0)
    if result is None:
        raise RuntimeError('Alignment did not produce timestamps')
    chars, times = [], []
    for segment in result.segments:
        for word in segment.words:
            s = canonical(word.word)
            for i, c in enumerate(s):
                chars.append(c)
                # Whisper's Chinese words are generally single characters. Retain the
                # full interval when a model word contains multiple characters.
                times.append((word.start, word.end, word.probability))
    actual = ''.join(chars)
    desired = canonical(transcript)
    mapped = {}
    for block in SequenceMatcher(None, desired, actual, autojunk=False).get_matching_blocks():
        for i in range(block.size):
            mapped[block.a+i] = times[block.b+i]
    cursor = len(canonical(title))
    total = aligned = zero = 0
    for paragraph in lesson['paragraphs']:
        for sentence in paragraph['sentences']:
            for token in sentence['tokens']:
                count = len(canonical(token['text']))
                hits = [mapped[i] for i in range(cursor, cursor+count) if i in mapped]
                total += count
                aligned += len(hits)
                cursor += count
                for key in ['start','end','timingConfidence']:
                    token.pop(key, None)
                if hits and len(hits) == count:
                    start, end = hits[0][0], hits[-1][1]
                    if end > start:
                        token.update(start=round(start,3), end=round(end,3), timingConfidence='machine')
                    else:
                        zero += count
                        token.update(start=round(start,3),end=round(start+.04,3),timingConfidence='low')
            spans = [t for t in sentence['tokens'] if 'start' in t]
            if spans:
                sentence.update(start=spans[0]['start'],end=spans[-1]['end'])
    coverage = aligned / max(total,1)
    usable = (aligned-zero) / max(total,1)
    lesson['alignmentStatus'] = 'machine-aligned' if usable > .92 else 'needs-review'
    lesson['alignmentQuality'] = {'method':'stable-ts / faster-whisper-base forced alignment',
                                  'coverage':round(coverage,4), 'usable':round(usable,4),
                                  'note':'Machine-generated word boundaries; review or correct at the playhead.'}
    lesson['processing'] = False
    lesson.pop('processingError',None)
    return lesson


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--id')
    parser.add_argument('--all',action='store_true')
    parser.add_argument('--force',action='store_true')
    parser.add_argument('--operation',default='all',choices=['annotate','align','all'])
    args=parser.parse_args()
    files=sorted((DATA/'lessons').glob('*.json')) if args.all else [path_for(args.id)]
    lex=json.loads((DATA/'dictionary.json').read_text(encoding='utf-8'))
    vocab=json.loads((DATA/'vocabulary.json').read_text(encoding='utf-8'))
    import jieba
    for w in vocab:
        jieba.add_word(w,freq=max(jieba.get_FREQ(w) or 0,10))
    model=None
    for file in files:
        lesson=json.loads(file.read_text(encoding='utf-8'))
        if args.all and not args.force and lesson.get('alignmentStatus') in ['machine-aligned','needs-review']:
            continue
        if not lesson.get('paragraphs') or args.operation=='annotate':
            lesson['paragraphs']=annotations(lesson['text'],lex,vocab)
            lesson['processing']=False
            write_json(file,lesson)
        if args.operation!='annotate' and lesson.get('audio'):
            if model is None:
                import stable_whisper
                model=stable_whisper.load_faster_whisper('base',device='cpu',compute_type='int8',
                        cpu_threads=6,download_root=str(ROOT/'.cache/models'))
            lesson['alignmentStatus']='aligning'
            write_json(file,lesson)
            try:
                lesson=align(lesson,model)
            except Exception as error:
                lesson['alignmentStatus']='failed'
                lesson['processingError']='Audio alignment failed. You can retry or adjust the word start manually.'
                write_json(file,lesson)
                print(f"FAILED {lesson['id']}: {error}",flush=True)
                if not args.all:
                    raise
                continue
            write_json(file,lesson)
            print(f"{lesson['id']}: {lesson['alignmentStatus']} {lesson['alignmentQuality']}",flush=True)


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
