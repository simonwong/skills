"""Check that an edited Markdown copy keeps the protected parts of the source."""

import argparse
import json
import re
import sys
from pathlib import Path

PATTERNS = {
    "frontmatter": (r"\A---\n.*?\n---\n", re.S),
    "fenced_code": (r"^```[^\n]*\n.*?^```[ \t]*$", re.M | re.S),
    "inline_code": (r"(?<!`)`[^`\n]+`(?!`)", 0),
    "headings": (r"^#{1,6} .+$", re.M),
    "link_targets": (r"\]\(([^)\n]+)\)", 0),
    "table_rows": (r"^\|.*\|$", re.M),
    "ordered_steps": (r"^\d+\. .+$", re.M),
    "html_ids": (r"<[^>]+\bid=\"[^\"]+\"[^>]*>", 0),
}


def protected(text):
    return {name: re.findall(pattern, text, flags) for name, (pattern, flags) in PATTERNS.items()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("edited", type=Path)
    args = parser.parse_args()
    before = protected(args.source.read_text(encoding="utf-8"))
    after = protected(args.edited.read_text(encoding="utf-8"))
    checks = {name: before[name] == after[name] for name in PATTERNS}
    passed = all(checks.values())
    print(json.dumps({"preserved": checks, "passed": passed}, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
