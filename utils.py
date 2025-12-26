import unicodedata
import re

def normalize_serial(serial: str) -> str:
    if not serial:
        return ""
    # 1. Trim whitespace
    s = serial.strip()
    # 2. Collapse consecutive whitespace
    s = re.sub(r'\s+', ' ', s)
    # 3. Uppercase
    s = s.upper()
    # 4. Unicode normalization (NFKC)
    s = unicodedata.normalize('NFKC', s)
    return s
