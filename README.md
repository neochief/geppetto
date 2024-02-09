# Geppetto: AI automation tool

This tool let you use OpenAI's GPTs in a declarative way. Instead of endless chatting with GPT, you declare parts of your prompt, the context, the output location, the post-processing instructions in a set of files. Geppetto compiles these files into a single prompt and sends it to GPT, then saves the output in the specified location. When brainstorming, you can send multiple requests to GPT in a single run, receiving all the variations of answers for the same prompt.

## Installation

```bash
npm install -g geppetto
```

## Usage

### 1. Setup your API key

Sign up for OpenAI API and set your API key as an environment variable. See the [official documentation](https://platform.openai.com/docs/quickstart), section **Step 2: Setup your API key**, for more details.


### 2. Define your prompt file

A prompt file is a free form markdown file with a few optional sections that you can define in the front matter (stuff at the beginning of the file between ---). Here's an example

**prompt.md**
```markdown
---
include:
  - _style.md
output: results
---

What is the meaning of life?
```

**_style.md**
```markdown
---
role: system
---
Imagine that you are Marcus Aurelius and you are writing a letter to your friend. You are in a good mood and you want to share your thoughts about the meaning of life.
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

### `-m`: GPT model to use

You can use different GPT models by specifying the `-m` option. The default is `gpt-4-turbo-preview`.

```bash
gep prompt.md -m gpt-3-turbo
```

## Prompt file options

- `include`: array of sub-files to include before the main prompt. You can think of these as the chat messages (either your prompts or GPT replies, see `role`) that go prior to your main prompt. `include` and `role` options can be used in the sub-files as well.
- `role`: this options specifies the type of the message (see `messages` in [API reference](https://platform.openai.com/docs/api-reference/chat)). Typically, a conversation is formatted with a `system` message first, followed by alternating `user` and `assistant` messages. Available values:
  - `user` (default): your prompt
  - `assistant`: GPT's reply
  - `system`: Prompt configuration
- `output`: the output file or directory where the results will be saved. If it's a directory, the results will be saved as separate files in the directory. If it's a file, the results will be saved in the file. If it's not defined, the results will be printed to the console.