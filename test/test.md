---
messages:
  - text: Add the exclamation mark to the end of the result.
    role: system
  - file: _test-include.md
    role: system
text: And lastly,
includeSeparator: " "
include: 
  - file: _test-text.md
output: results
---

