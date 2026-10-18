"""Extract each lesson's numbered textbook vocabulary, preserving its order."""
import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path

import fitz
import numpy as np
from rapidocr_onnxruntime import RapidOCR
from pypinyin import lazy_pinyin, Style

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
HAN = re.compile(r"[\u3400-\u9fff]")


def extract(only=None):
    engine = None
    docs = {volume: fitz.open(ROOT / f"HSK5{volume}.pdf") for volume in ["上", "下"]}
    dictionary = json.loads((DATA / "dictionary.json").read_text(encoding="utf-8"))
    syllabus = json.loads((DATA / "vocabulary.json").read_text(encoding="utf-8"))
    report = []
    for number in range(1, 37):
        if only and number not in only:
            continue
        lesson = json.loads((DATA / "lessons" / f"course-{number:02}.json").read_text(encoding="utf-8"))
        entries = []
        page_results = []
        for page_number in lesson["sourcePages"]:
            page = docs[lesson["volume"]][page_number - 1]
            lines = [line for block in page.get_text("dict")["blocks"] for line in block.get("lines", [])]
            notes = [line["bbox"][1] for line in lines if line["bbox"][0] < 160 and re.search("注释|Notes", "".join(s["text"] for s in line["spans"]))]
            top = 60
            if page_number == lesson["sourcePages"][0]:
                headings = [line["bbox"][1] for line in lines if line["bbox"][0] > 320 and "生词" in "".join(s["text"] for s in line["spans"])]
                top = min(headings) if headings else 360
            numbered_left = [line["bbox"][0] for line in lines if 300 < line["bbox"][0] < 390 and re.match(r"^[*\s]*\d{1,2}[.\s]+[\u3400-\u9fff]", "".join(span["text"] for span in line["spans"]).strip())]
            column_left = min(319, min(numbered_left, default=323) - 4)
            rect = fitz.Rect(column_left, top, page.rect.width - 53, min(notes, default=755) - 3)
            key = hashlib.sha1((page.parent.name + str(page.number) + str(rect)).encode()).hexdigest()[:18]
            cache = ROOT / ".cache" / "vocabulary-ocr" / f"{key}.json"
            if cache.exists():
                results = json.loads(cache.read_text(encoding="utf-8"))
            else:
                if engine is None:
                    engine = RapidOCR(intra_op_num_threads=4, inter_op_num_threads=2)
                pix = page.get_pixmap(matrix=fitz.Matrix(3, 3), clip=rect)
                image = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
                results, _ = engine(image, use_cls=False)
                cache.parent.mkdir(parents=True, exist_ok=True)
                cache.write_text(json.dumps(results or [], ensure_ascii=False), encoding="utf-8")
            rows = []
            for box, text, confidence in sorted(results or [], key=lambda row: sum(p[1] for p in row[0]) / 4):
                y = sum(p[1] for p in box) / 4 / 3 + rect.y0
                x = min(p[0] for p in box) / 3 + rect.x0
                text = unicodedata.normalize("NFKC", text).strip()
                if rows and abs(rows[-1]["y"] - y) < 5:
                    rows[-1]["parts"].append((x, text))
                else:
                    rows.append({"y": y, "parts": [(x, text)]})
            parsed = []
            for row in rows:
                text = " ".join(text for _, text in sorted(row["parts"]))
                text = re.sub(r"(?<![A-Za-z])B(?=\d[.：:])", "3", text)
                match = re.search(r"(?<!\d)(\d{1,2})\s*[.．、：:]?\s*([（(\u3400-\u9fff][()（）\u3400-\u9fff…·— /]*)", text)
                if match:
                    printed = re.sub(r"\s", "", match[2]).rstrip("·/（(")
                    word = re.sub(r"[（(][^）)]*[）)]", "", printed)
                    if HAN.search(word):
                        parsed.append({"number": int(match[1]), "text": word, **({"display": printed.replace("(", "（").replace(")", "）")} if printed != word else {}), "page": page_number, "starred": "*" in text[:match.start(2)], "ocr": text})
            entries.extend(parsed)
            page_results.append({"page": page_number, "rows": [" ".join(text for _, text in sorted(row["parts"])) for row in rows]})
        # Proper names have their own numbering; they are not part of the new-word list.
        ordered = []
        for entry in entries:
            if ordered and entry["number"] <= ordered[-1]["number"]:
                break
            ordered.append(entry)
        entries = ordered
        corrections_file = ROOT / "scripts" / "course_vocabulary_corrections.json"
        corrections = json.loads(corrections_file.read_text(encoding="utf-8")) if corrections_file.exists() else {}
        lesson_corrections = corrections.get(lesson["id"], {})
        for entry_number, correction in lesson_corrections.items():
            existing = next((entry for entry in entries if entry["number"] == int(entry_number)), None)
            if existing:
                existing.update(correction if isinstance(correction, dict) else {"text": correction})
            else:
                entries.append({"number": int(entry_number), **correction})
        entries.sort(key=lambda entry: entry["number"])
        context = lesson["title"] + lesson["text"]
        context_pinyin = lazy_pinyin(context, style=Style.TONE, errors=lambda text: list(text))
        for entry in entries:
            word = entry["text"]
            definition = dictionary.get(word, {})
            position = context.find(word)
            pinyin = " ".join(context_pinyin[position:position + len(word)]) if position >= 0 else " ".join(lazy_pinyin(word, style=Style.TONE))
            meanings = [meaning for meaning in definition.get("definitions", []) if not re.match(r"surname |variant of |old variant |CL:|see ", meaning)]
            entry.update(pinyin=entry.get("pinyin", pinyin), meaning=entry.get("meaning", "; ".join(meanings[:3])), level=syllabus.get(word, {}).get("level"))
            entry.pop("ocr", None)
        output = {"id": lesson["id"], "sourcePages": lesson["sourcePages"], "words": entries}
        target = DATA / "course-vocabulary" / f"{lesson['id']}.json"
        target.parent.mkdir(exist_ok=True)
        target.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
        numbers = [entry["number"] for entry in entries]
        gaps = sorted(set(range(1, max(numbers, default=0) + 1)) - set(numbers))
        report.append({"id": lesson["id"], "count": len(entries), "missing": gaps, "pages": page_results})
        print(lesson["id"], len(entries), "missing", gaps, flush=True)
    (DATA / "course-vocabulary" / "extraction-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--lessons", nargs="+", type=int)
    extract(parser.parse_args().lessons)
