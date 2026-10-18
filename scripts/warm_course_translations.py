"""Precompute course sentence translations locally; preserve existing translations."""
import argparse
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

def read(file):
    return json.loads(file.read_text(encoding="utf-8")) if file.exists() else {}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int)
    parser.add_argument("--batch-size", type=int, default=8)
    args = parser.parse_args()
    target = DATA / "course-translations.json"
    generated = read(target)
    existing = {**generated, **read(DATA / "translations.json")}
    sentences = list(dict.fromkeys(sentence["text"] for file in sorted((DATA / "lessons").glob("course-*.json")) for paragraph in read(file)["paragraphs"] for sentence in paragraph["sentences"]))
    missing = [text for text in sentences if text not in existing]
    if args.limit:
        missing = missing[:args.limit]
    print(json.dumps({"courseSentences": len(sentences), "missing": len(missing), "alreadyCached": len(sentences) - sum(text not in existing for text in sentences)}), flush=True)
    if not missing:
        return
    import torch
    from transformers import MarianMTModel, MarianTokenizer

    torch.set_num_threads(4)
    model_path = ROOT / ".cache" / "translator"
    tokenizer = MarianTokenizer.from_pretrained(str(model_path), local_files_only=True)
    model = MarianMTModel.from_pretrained(str(model_path), local_files_only=True)
    model.eval()
    started = time.monotonic()
    for offset in range(0, len(missing), args.batch_size):
        batch = missing[offset:offset + args.batch_size]
        # Match the interactive translator's chunk limits and beam search settings.
        chunks = [(text, text[index:index + 350]) for text in batch for index in range(0, len(text), 350)]
        inputs = tokenizer([chunk for _, chunk in chunks], return_tensors="pt", padding=True, truncation=True, max_length=512)
        with torch.inference_mode():
            output = model.generate(**inputs, max_new_tokens=256, num_beams=3)
        translations = {}
        for (text, _), result in zip(chunks, tokenizer.batch_decode(output, skip_special_tokens=True)):
            translations.setdefault(text, []).append(result)
        generated.update({text: " ".join(values) for text, values in translations.items()})
        temporary = target.with_suffix(".tmp")
        temporary.write_text(json.dumps(generated, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        temporary.replace(target)
        print(json.dumps({"done": min(offset + args.batch_size, len(missing)), "total": len(missing), "seconds": round(time.monotonic() - started, 1)}), flush=True)

if __name__ == "__main__":
    main()
