---
messages:
  - text: Add the exclamation mark to the end of the result.
    role: system
    
  - file: includes/_subMessage.md

  - text: |
      Save as 3 files the results of the following tasks (format filename as "hamlet_%lang%.txt", where %lang% is two letter iso code of the language):  
    include:
    - includes/_subText0.md
    - includes/_subText1.md
    - includes/_subText2.md
      
outputDir: .
outputVersioned: false
outputAsFiles: true
---