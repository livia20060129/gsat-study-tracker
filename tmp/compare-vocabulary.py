import re
from pathlib import Path

from pypdf import PdfReader


PART_OF_SPEECH = re.compile(r"(?:^|\s)(?:art|adj|adv|n|v|prep|conj|pron)\.")
ENGLISH_ENTRY = re.compile(r"^[A-Za-z][A-Za-z0-9()/'’., -]*$")


def expand_entry(entry: str) -> set[str]:
    values: set[str] = set()
    for variant in entry.split('/'):
        variant = variant.strip(" .,\n\t")
        if not variant:
            continue
        parenthetical = re.fullmatch(r"(.+?)\(([^)]+)\)", variant)
        if parenthetical:
            base, suffix = parenthetical.groups()
            values.add(base.casefold())
            values.add(f"{base}{suffix}".casefold())
        else:
            values.add(variant.casefold())
    return values


reader = PdfReader(Path('tmp/ceec-high-school-vocabulary.pdf'))
official: set[str] = set()
for page in reader.pages[64:115]:
    pending = ''
    for raw_line in (page.extract_text() or '').splitlines():
        line = ' '.join(raw_line.split()).strip()
        match = PART_OF_SPEECH.search(line)
        if match:
            entry = line[:match.start()].strip() or pending
            if ENGLISH_ENTRY.fullmatch(entry):
                official.update(expand_entry(entry))
            pending = ''
        elif ENGLISH_ENTRY.fullmatch(line) and not line.isupper():
            pending = line
        else:
            pending = ''

candidates = [
    line.strip()
    for line in Path('tmp/current-vocabulary-words.txt').read_text(encoding='utf-8').splitlines()
    if line.strip()
]
present = [word for word in candidates if word.casefold() in official]
missing = [word for word in candidates if word.casefold() not in official]

print(f'OFFICIAL {len(official)}')
print(f'PRESENT {len(present)}')
print('\n'.join(present))
print(f'---MISSING {len(missing)}')
print('\n'.join(missing))
