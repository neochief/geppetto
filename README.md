# Geppetto: AI automation tool

This tool let you use OpenAI's GPTs in a declarative way. Instead of endless chatting with GPT, you declare parts of your prompt, the context, the output location, the post-processing instructions in a set of files. Geppetto compiles these files into a single prompt and sends it to GPT, then saves the output in the specified location. When brainstorming, you can send multiple requests to GPT in a single run, receiving all the variations of answers for the same prompt.

## Installation

```bash
npm install -g @neochief/geppetto
```

## Usage

### 1. Setup your API key

Sign up for OpenAI API and set your API key as an environment variable. See the [official documentation](https://platform.openai.com/docs/quickstart), section **Step 2: Setup your API key**, for more details.


### 2. Define your prompt file

A prompt file is a free form markdown file with a few optional sections that you can define in the front matter (stuff at the beginning of the file between ---). Here's an example

**prompt.md**
```markdown
---
messages:
  - file: prompt_style.md
  - text: Don't forget that you're a Roman Emperor.
    role: system
include:
  - ps.md
output: results
---

What is the meaning of life?
```

**ps.md**
```markdown
P.S. I'm writing from XXI century.
```

**prompt_style.md**
```markdown
---
role: system
---
Imagine that you are Marcus Aurelius and you are writing a letter to your friend. You are in a good mood and you want to share your thoughts about the meaning of life.
```

This will result into a prompt consisting of two messages:

```
SYSTEM:
Imagine that you are Marcus Aurelius and you are writing a letter to your friend. You are in a good mood and you want to share your thoughts about the meaning of life.

SYSTEM:
Don't forget that you're a Roman Emperor.

USER:
What is the meaning of life?

P.S. I'm writing from XXI century.
``` 

### 3. Run Geppetto (with `gep` for convenience)

```bash
gep prompt.md
```

## Arguments

### `-t`: Times to run

You can run the same prompt multiple times using the `-t` option. If `output` is defined in the prompt file, and it's a directory, the results will be saved as a separate files in the outut directory. This option is useful while brainstorming: usually GPT produces slightly different results each time you run the prompt, so you can run once with `-t` and then pick the best result.

```bash
gep prompt.md -t 10
```

Tip: If you pass `-t 0`, you can see the prompt without wasting API calls.

### `-m`: GPT model to use

You can use different GPT models by specifying the `-m` option. The default is `gpt-4-turbo-preview`.

```bash
gep prompt.md -m gpt-3-turbo
```

### `-s`: Silent mode

By default, Geppetto prints the full prompt and the results to the console. You can disable this behavior by using the `-s` option.

```bash
gep prompt.md -s
```

## Prompt file options

- `text`: text string that will be used as message.
- `include`: array of path names to a files that will used as part of message. If the `text` is passed, the result of include is added after.
- `includeSeparator`: a string separator that will be used to join items passed in `include`. By default, the separator is "\n\n";
- `role`: the default role that will be used for send all the messages (can be overridden in the message sub-files). This options specifies the type of the message (see `messages` in [API reference](https://platform.openai.com/docs/api-reference/chat)). Typically, a conversation is formatted with a `system` message first, followed by alternating `user` and `assistant` messages. Available values:
  - `user` (default): your prompt
  - `assistant`: GPT's reply
  - `system`: Prompt configuration

- `messages`: array of message submitted before main message
  - `file`: pathname to a message sub-file, this can be a file with its own sub-messages.
  - `text`: same as above
  - `include`: same as above
  - `includeSeparator`: same as above
  - `role`: same as above

- `output`: the output directory where the results will be saved. The results will be saved in a new sub-folder each time the script is launched. This sub-folder will also include a file with the prompt. This helps to iterate the changes to the source files, while having the original prompt close to the results. If this option is not defined, the results will only be printed to the console.