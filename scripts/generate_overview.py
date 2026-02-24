#!/usr/bin/env python3
"""
Generate an overview JSON for a Markdown textbook.

Usage:
  python scripts/generate_overview.py \
      --markdown path/to/textbook.md \
      --out overview.json \
      --provider openai

This script uses the project's `LLMFactory` to summarize each top-level section and
its subsections into a structured JSON document containing: section title,
subsection titles, and key points for each subsection.

It is defensive: if API keys are missing it will not call external APIs.
"""

import argparse
import json
import os
import re
from typing import List, Dict

import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.core.llm_client import LLMFactory, ModelProvider


SECTION_RE = re.compile(r"^#\s+(.*)", re.MULTILINE)
SUBSECTION_RE = re.compile(r"^##\s+(.*)", re.MULTILINE)


def split_sections(markdown: str) -> List[Dict]:
    """Return a list of sections with their markdown content and subsections."""
    sections = []
    sec_positions = [(m.start(), m.end(), m.group(1).strip()) for m in SECTION_RE.finditer(markdown)]
    if not sec_positions:
        return [{"title": "full", "content": markdown}]

    for idx, (start, end, title) in enumerate(sec_positions):
        next_start = sec_positions[idx + 1][0] if idx + 1 < len(sec_positions) else len(markdown)
        content = markdown[end:next_start].strip()
        # find subsections inside content
        subsections = []
        for sm in SUBSECTION_RE.finditer(content):
            s_pos = sm.start()
            s_title = sm.group(1).strip()
            # determine s_content by searching next subsection or end of section
            # naive approach: split by lines
            subsections.append({"title": s_title})

        sections.append({"title": title, "content": content, "subsections": subsections})
    return sections


PROMPT_TEMPLATE = (
    "Provide a JSON object with keys: 'summary' (a short paragraph overview), "
    "'subsections' (list of {title, key_points:[str]}) for the following content.\n\nContent:\n{content}"
)


def summarize_with_client(client, content: str):
    prompt = PROMPT_TEMPLATE.format(content=content)
    # Request structured JSON from the provider
    try:
        return client.generate_json(prompt, schema={
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "subsections": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "key_points": {"type": "array", "items": {"type": "string"}}
                        },
                        "required": ["title", "key_points"]
                    }
                }
            },
            "required": ["summary", "subsections"]
        }, max_tokens=800)
    except Exception as e:
        raise


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--markdown", required=True, help="Path to textbook markdown")
    p.add_argument("--out", required=True, help="Output JSON file")
    p.add_argument("--provider", default="openai", choices=["openai", "deepseek", "google"])
    p.add_argument("--model", default=None)
    p.add_argument("--temperature", type=float, default=0.3, help="temperature for JSON generation (defaults to 0.3)")
    args = p.parse_args()

    if not os.path.exists(args.markdown):
        print("Markdown file not found", args.markdown)
        raise SystemExit(1)

    with open(args.markdown, "r", encoding="utf-8") as f:
        md = f.read()

    sections = split_sections(md)

    # Delegate to the reusable function
    generate_overview(args.markdown, args.out, args.provider, model_name=args.model, temperature=args.temperature)


def generate_overview(markdown_path: str, out_path: str, provider_str: str = "openai", model_name: str = None, temperature: float = 0.3) -> dict:
    """Generate overview JSON from a markdown file.

    Returns the overview dict and writes it to `out_path`.
    """
    if not os.path.exists(markdown_path):
        raise FileNotFoundError(markdown_path)

    with open(markdown_path, "r", encoding="utf-8") as f:
        md = f.read()

    sections = split_sections(md)

    provider_map = {"openai": ModelProvider.OPENAI, "deepseek": ModelProvider.DEEPSEEK, "google": ModelProvider.GOOGLE}
    if provider_str not in provider_map:
        raise ValueError(f"Unknown provider: {provider_str}")
    provider = provider_map[provider_str]

    # Create a client; JSON generation uses temperature=0.3 internally, but we still pass temperature to client creation.
    client = LLMFactory.create_client(provider, model_name=model_name, temperature=temperature)

    overview = {"source": os.path.basename(markdown_path), "sections": []}

    for sec in sections:
        sec_title = sec.get("title")
        sec_content = sec.get("content", "")

        try:
            summary_obj = summarize_with_client(client, sec_content or sec_title)
        except Exception as e:
            print(f"Failed to summarize section {sec_title}: {e}")
            summary_obj = {"summary": "", "subsections": []}

        overview["sections"].append({
            "title": sec_title,
            "summary": summary_obj.get("summary"),
            "subsections": summary_obj.get("subsections"),
        })

    with open(out_path, "w", encoding="utf-8") as outf:
        json.dump(overview, outf, ensure_ascii=False, indent=2)

    print("Overview written to", out_path)
    return overview


if __name__ == "__main__":
    main()
