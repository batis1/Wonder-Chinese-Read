"""Convert the supplied books' usage notes and comparisons into structured text."""
import json
import re
import subprocess
import unicodedata
import argparse
import hashlib
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
HAN = re.compile(r"[\u3400-\u9fff]")
NUMBER = re.compile(r"^[（(]\s*([1-9Il])\s*[)）]\s*")
PRACTICE = re.compile(r"练[一－—-]?练|做[一－—-]?做|完成句|完成旬|选词填空|用所学|判断各句")
OCR = False
OCR_ENGINE = None


def clean(text):
    text = unicodedata.normalize("NFKC", text).strip()
    text = re.sub(r"(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])", "", text)
    text = re.sub(r"\s+([，。？！、；：])", r"\1", text)
    text = text.replace("笫", "第").replace("小旬", "小句").replace("旬子", "句子").replace("用于旬", "用于句")
    text = text.replace("\"'", "”，").replace("I在", "/在")
    return re.sub(r"\s+", " ", text).strip()


def page_lines(page):
    lines = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            x0, y0, x1, y1 = line["bbox"]
            if y0 < 42 or y0 > 754 or x0 < 40 or x0 > page.rect.width - 33:
                continue
            text = clean("".join(span["text"] for span in line["spans"]))
            if not text:
                continue
            if "标准教程" in text or re.match(r"^5\s*\([上下]", text):
                continue
            if x0 > page.rect.width - 80 and len(HAN.findall(text)) == 1 and x1 - x0 < 15:
                continue
            lines.append({"text": text, "x": x0, "y": y0, "right": x1, "bottom": y1})
    return sorted(lines, key=lambda item: (round(item["y"] / 4), item["x"]))


def rows_from(lines):
    rows = []
    for line in sorted(lines, key=lambda item: item["y"]):
        if rows and abs(rows[-1]["y"] - line["y"]) < 4:
            rows[-1]["parts"].append(line)
        else:
            rows.append({"y": line["y"], "parts": [line]})
    for row in rows:
        parts = sorted(row["parts"], key=lambda item: item["x"])
        text = ""
        for i, part in enumerate(parts):
            gap = part["x"] - parts[i - 1]["right"] if i else 0
            text += (" _____ " if gap > 55 and i else " ") + part["text"]
        row.update(text=clean(text), x=parts[0]["x"], bottom=max(part["bottom"] for part in parts))
    return rows


def point_name(text):
    return "".join(HAN.findall(text))


def append_block(note, text, practice=False, new_paragraph=False):
    if not HAN.search(text) and not NUMBER.match(text) and not re.match(r"^[AB]:", text):
        return
    match = NUMBER.match(text)
    blocks = note["practice" if practice else "blocks"]
    if match:
        blocks.append({"type": "exercise" if practice else "example", "number": int(match[1]) if match[1].isdigit() else 1, "text": text[match.end():]})
    elif practice:
        if not blocks:
            blocks.append({"type": "exercise", "text": text})
        else:
            blocks[-1]["text"] += ("\n" if re.match(r"^[AB]:", text) else "") + text
    elif not blocks or (blocks[-1]["type"] == "example" and (new_paragraph or (text.startswith(("“", "”", '"', "'")) and (note["point"] in text[:15] or "动词" in text[:15])) or text.startswith(("此外", "另外", "注意")) or "例如" in text)):
        blocks.append({"type": "explanation", "text": text})
    else:
        blocks[-1]["text"] += ("\n" if re.match(r"^[AB]:", text) else "") + text


def typography(text):
    text = re.sub(r"5\s*\(\s*[上下]\s*\)", "", text)
    text = re.sub(r"\s*_____.*$", "", text)
    repairs = {
        "时时亥U亥tl": "时时刻刻", "伊U 女廿": "例如", "伊l女廿": "例如", "又寸上七": "对比",
        "立刻，，": "立刻", "则，，": "则", "汗，，": "汗", "。5 ( 上)": "。",
        "，，": "，", "我们琪": "我们班", "下琪": "下班", "加躯": "加班", "我们躯": "我们班", "六琪": "六班",
        "饮朴": "饮料", "牙祁": "牙根", "准各": "准备", "材籵": "材料", "颜籵": "颜料", "姐娃": "姐妹",
        "吵闹卢": "吵闹声", "铃卢": "铃声", "所说的清态": "所说的情态", "的清态": "的情态", "后旬": "后句",
        "几于块": "几千块", "休重": "体重", "上雍": "上班", "槽糕": "糟糕", "总栽": "总裁", "解宇": "解字",
        "醉眼蒙胧": "醉眼朦胧", "彷往呐喊": "彷徨呐喊", "求已": "求己", "嬴": "赢",
        "出未": "出来", "下未": "下来", "将未": "将来", "未往": "来往", "未未": "未来", "未得": "来得", "找未": "找来",
        "走未": "走来", "对公司未说": "对公司来说", "跑未": "跑来", "研究未": "研究来", "流传下未": "流传下来",
        "到未": "到来", "白未": "白来", "后未": "后来", "一未": "二来", "压力未做": "压力来做",
        "一来……，一来……": "一来……，二来……", "此与后并": "从此与后羿", "可见“自知”": "可见“自知”",
        "“明”，见": "“明”，可见", "而爬": "而是"
    }
    for old, new in repairs.items():
        text = text.replace(old, new)
    text = re.sub(r"\([^)]*[a-zA-Z]{2,}[^)]*\)", "", text)
    for old, new in {"用千": "用于", "反问旬": "反问句", "否定旬": "否定句", "间句": "问句", "时问": "时间", "自已": "自己", "回未": "回来", "本未": "本来", "再未这里": "再来这里", "飞未": "飞来", "起未": "起来", "看未": "看来", "未新房": "来新房", "漫慢": "慢慢", "嬴得": "赢得", "嬴了": "赢了", "嬴吗": "赢吗"}.items():
        text = text.replace(old, new)
    text = re.sub(r"[\"“”']{2,}", '"', text)
    opening = True
    output = []
    for char in text:
        if char in '\"“”\'':
            output.append("“" if opening else "”")
            opening = not opening
        else:
            output.append(char)
    text = "".join(output)
    text = re.sub(r"(?<=[\u3400-\u9fff])I(?=[\u3400-\u9fff])", "/", text)
    text = re.sub(r"\.{3,}", "……", text)
    text = text.translate(str.maketrans({",": "，", ":": "：", ";": "；", "?": "？", "!": "！"}))
    text = re.sub(r"”\s*“(?=(?:副词|连词|也可以))", "”，", text)
    text = text.replace("“就”便“", "“就、便”")
    text = re.sub(r"(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])", "", text)
    text = re.sub(r"([。！？])\s*\.+$", r"\1", text)
    text = text.replace("一来……，一来……", "一来……，二来……")
    for old, new in {
        "“立刻，，”副词": "“立刻”，副词", "“则，，，量词": "“则”，量词",
        "“汗，，，": "“汗”，", "彷徨呐喊两悠悠，，”": "彷徨呐喊两悠悠。”",
        "如：去每走一步": "如：每走一步", "的的意思": "的意思"
    }.items():
        text = text.replace(old, new)
    text = re.sub(r"\s*([，。；：？！])\s*", r"\1", text)
    text = re.sub(r"([“（])\s+|\s+([”）])", lambda match: match[1] or match[2], text)
    return text.strip()


def finish(points):
    definitions = {
        "以来": {0: "“以来”用在时间名词或短语后，构成“……以来”，表示从过去某时到现在的一段时间。例如："},
        "至今": {0: "“至今”，副词，意思是“直到现在”，常用于小句句首或动词前。也可构成“从古至今”“流传至今”等固定结构。例如："},
        "时刻": {3: "“时刻”也可以做副词，表示每时每刻、经常等意思，能重叠为“时时刻刻”。例如："},
        "则": {3: "“则”，连词，常见结构为“A……，（而）B则……”，表示前后两项的对比。例如："},
        "得起": {0: "“动词＋得/不＋起”表示主观上有（没有）实现或承受某种动作的能力和条件。例如："},
        "动词过": {0: "“动词＋过”表示通过动作，人或物体改变方向。例如：", 3: "也可以表示通过动作，人或物体移动位置。例如："},
        "开": {0: "“动词＋开”表示舒展。例如："},
        "嗯": {0: "“嗯”，叹词。读 ńg 时，表示疑问。例如：", 3: "读 ňg 时，表示感觉意外或认为不该是这样。例如：", 6: "读 ǹg 时，表示答应或认同。例如："}
    }
    for note in points:
        for index, block in enumerate(note.get("blocks", [])):
            block["text"] = definitions.get(note["point"], {}).get(index, typography(block["text"]))
        note["common"] = [typography(text) for text in note.get("common", [])]
        for term in note.get("terms", []):
            term["paragraphs"] = [part for text in term["paragraphs"] for part in re.split(r"(?<=。)(?=如：?)", typography(text)) if part]
    return points


def paragraph_text(page, rect):
    global OCR_ENGINE
    if rect.y1 <= rect.y0:
        return []
    if OCR:
        key = hashlib.sha1((page.parent.name + str(page.number) + str(rect)).encode()).hexdigest()[:18]
        file = ROOT / ".cache" / "note-ocr" / f"{key}.json"
        if file.exists():
            text = json.loads(file.read_text(encoding="utf-8"))["text"]
        else:
            import numpy as np
            from rapidocr_onnxruntime import RapidOCR
            if OCR_ENGINE is None:
                OCR_ENGINE = RapidOCR(intra_op_num_threads=4, inter_op_num_threads=2)
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5), clip=rect)
            image = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(pixmap.height, pixmap.width, pixmap.n)
            result, _ = OCR_ENGINE(image, use_cls=False)
            text = "\n".join(row[1] for row in sorted(result or [], key=lambda item: (round(item[0][0][1] / 12), item[0][0][0])))
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(json.dumps({"text": text}, ensure_ascii=False), encoding="utf-8")
    else:
        text = page.get_text("text", clip=rect, sort=True)
    lines = []
    for line in text.splitlines():
        line = clean(line)
        if not HAN.search(line) and not re.search(r"\d+\s*[℃°]", line):
            continue
        if re.match(r"^(?:5\s*)?\(?[上下]\)?$", line):
            continue
        line = re.sub(r"^[I|:;；：｝}·•\s]+", "", line)
        line = re.sub(r"[I|:;；：｝}]+$", "", line).strip()
        if line and line not in ["共同点", "不同点", "共", "同", "不", "点"]:
            lines.append(line)
    output = []
    for line in lines:
        if not output or re.match(r"^[1-9][.、．]", line) or line.startswith("如:") or line.startswith("如："):
            output.append(line)
        else:
            output[-1] += line
    return output


def comparison(doc, pages, pair):
    left, right = pair[:2]
    result = {"point": f"{left} / {right}", "kind": "comparison", "pages": [], "common": [], "terms": [{"word": left, "paragraphs": []}, {"word": right, "paragraphs": []}]}
    started = False
    for number in pages:
        page = doc[number - 1]
        lines = page_lines(page)
        headings = [line for line in lines if left in line["text"] and right in line["text"] and line["x"] < 145 and len(line["text"]) < 45 and re.search(re.escape(left) + r"[—－–一/-]+" + re.escape(right), line["text"])]
        if not started and not headings:
            continue
        top = headings[0]["bottom"] if headings else 42
        started = True
        headers = [line for line in lines if point_name(line["text"]) in [left, right] and line["y"] > top and line["x"] > 160]
        relevant_headers = [line for line in headers if line["y"] < top + 65]
        header_bottom = max((line["bottom"] for line in relevant_headers), default=top)
        end = min((line["y"] for line in lines if line["y"] > top and (PRACTICE.search(line["text"]) or line["text"].startswith("练习"))), default=754)
        if end <= header_bottom + 4:
            break
        first_difference = min((line["y"] for line in lines if header_bottom < line["y"] < end and re.search(r"\b[1IlL]\s*[.、．]", line["text"])), default=min((line["y"] for line in lines if header_bottom < line["y"] < end and point_name(line["text"]) == "不" and line["x"] < 155), default=header_bottom))
        centers = [(line["x"] + line["right"]) / 2 for line in relevant_headers]
        middle = (min(centers) + max(centers)) / 2 - 3 if len(centers) >= 2 else page.rect.width * 0.575
        content_left = min((line["x"] for line in lines if header_bottom < line["y"] < end and line["x"] < middle and len(HAN.findall(line["text"])) > 3), default=150) - 2
        common = paragraph_text(page, fitz.Rect(content_left, header_bottom - 1, page.rect.width - 30, first_difference - 1)) if first_difference > header_bottom else []
        result["common"].extend(common)
        for index, (x0, x1) in enumerate([(content_left, middle - 2), (middle + 2, page.rect.width - 30)]):
            result["terms"][index]["paragraphs"].extend(paragraph_text(page, fitz.Rect(x0, first_difference - 1, x1, end - 2)))
        result["pages"].append(number)
        if end < 754:
            break
    return result


def extract(only=None):
    config = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", "import {coursePoints} from './src/grammar.js'; import {distinctions} from './src/distinctions.js'; console.log(JSON.stringify({coursePoints,distinctions}));"], cwd=ROOT, encoding="utf-8"))
    docs = {volume: fitz.open(ROOT / f"HSK5{volume}.pdf") for volume in ["上", "下"]}
    report = []
    for item in json.loads((DATA / "catalog.json").read_text(encoding="utf-8")):
        if only and item["number"] not in only:
            continue
        lesson = json.loads((DATA / "lessons" / f"{item['id']}.json").read_text(encoding="utf-8"))
        expected = config["coursePoints"][lesson["number"] - 1]
        notes = {point: {"point": point, "kind": "usage", "pages": [], "blocks": [], "practice": []} for point in expected}
        current = None
        practice = False
        started = False
        finished = False
        previous_bottom = 0
        for number in lesson["grammarPages"]:
            lines = page_lines(docs[lesson["volume"]][number - 1])
            for row in rows_from(lines):
                if finished:
                    continue
                text = row["text"]
                name = point_name(text)
                heading = row["x"] < 125 and len(text) < 35 and (text.startswith("Notes") or not re.search(r"[()（）:：\"“”]", text)) and not NUMBER.match(text)
                aliases = {"得起": ["动词得不起"], "于": ["千"], "为": ["为压旬"], "未": ["来"], "万一": ["万"], "动词过": ["过"]}
                match = next((point for point in expected if heading and any(name.endswith(alias) and len(name) <= len(alias) + 4 for alias in [point, *aliases.get(point, [])])), None)
                if match:
                    current = notes[match]
                    practice = False
                    started = True
                    if number not in current["pages"]: current["pages"].append(number)
                    continue
                definition = next((point for point in expected if not notes[point]["blocks"] and re.match(r'^[“”\"\s]*' + re.escape(point) + r'[“”\"\s]*[,，]', text)), None)
                if definition:
                    current = notes[definition]
                    practice = False
                    started = True
                if "词语搭配" in name or "词语辨析" in name or "练习" == name or "Exercises" in text:
                    current = None
                    finished = True
                if not started or current is None:
                    continue
                if PRACTICE.search(text):
                    practice = True
                    continue
                if len(name) <= 1 and len(text) < 3:
                    continue
                if number not in current["pages"]: current["pages"].append(number)
                append_block(current, text, practice, 9 < row["y"] - previous_bottom < 45)
                previous_bottom = row["bottom"]
        points = list(notes.values())
        points.append(comparison(docs[lesson["volume"]], lesson["grammarPages"], config["distinctions"][lesson["number"] - 1]))
        points = finish(points)
        corrections_file = ROOT / "scripts" / "course_note_corrections.json"
        corrections = json.loads(corrections_file.read_text(encoding="utf-8")) if corrections_file.exists() else {}
        for note in points:
            override = corrections.get(lesson["id"], {}).get(note["point"])
            if override:
                note.update(override)
        output = {"id": lesson["id"], "sourcePages": lesson["grammarPages"], "points": points}
        target = DATA / "course-notes" / f"{lesson['id']}.json"
        target.parent.mkdir(exist_ok=True)
        target.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
        report.append({"id": lesson["id"], "points": [{"point": note["point"], "pages": note["pages"], "blocks": len(note.get("blocks", [])), "examples": sum(block["type"] == "example" for block in note.get("blocks", [])), "common": len(note.get("common", [])), "columns": [len(term["paragraphs"]) for term in note.get("terms", [])]} for note in points]})
    report_file = DATA / "course-notes" / "extraction-report.json"
    report_file.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    for row in report:
        missing = [note["point"] for note in row["points"] if not note["pages"] or (not note["blocks"] and not any(note["columns"]))]
        print(row["id"], "MISSING: " + ", ".join(missing) if missing else "OK", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--ocr-comparisons", action="store_true")
    parser.add_argument("--lessons", nargs="+", type=int)
    args = parser.parse_args()
    OCR = args.ocr_comparisons
    extract(args.lessons)
