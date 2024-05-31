# Geppetto: AI automation tool

This tool let you use OpenAI's and Anthropic's LLMs in a declarative way. Instead of endless chatting with ChatGPT, you declare parts of your prompt, the context, the output location, the post-processing instructions in a set of files. Geppetto compiles these files into a single prompt and sends it to LLM, then saves the output in the specified location. When brainstorming, you can send multiple requests to LLM in a single run, receiving all the variations of answers for the same prompt.

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
outputDir: results
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

You can run the same prompt multiple times using the `-t` option. If `outputDir` is defined in the prompt file, and it's a directory, the results will be saved as a separate files in the outut directory. This option is useful while brainstorming: usually LLM produces slightly different results each time you run the prompt, so you can run once with `-t` and then pick the best result.

```bash
gep prompt.md -t 10
```

### `-m`: LLM model to use

You can use different LLM models by specifying the `-m` option. The default is `gpt-4-turbo-preview`.

```bash
gep prompt.md -m gpt-3.5-turbo
```

Available models: 

- gpt-4-turbo
- gpt-4o
- gpt-4
- gpt-3.5-turbo
- claude-3-opus-20240229
- claude-3-sonnet-20240229

Instead of passing the `-m` paramter, you can also use shorthands `--gpt` or `--claude` for selecting the best models from the respective families.

### `-s`: Silent mode

By default, Geppetto prints the full prompt and the results to the console. You can disable this behavior by using the `-s` option.

### `--dry-run`: Dry run

Do not send the prompt to LLM, just print the prompt to the console.

```bash
gep prompt.md -s
```

## Prompt file options

- `text`: text string that will be used as message.
- `include`: array of path names to a files that will used as part of message. If the `text` is passed, the result of include is added after.
- `separator`: a string separator that will be used to join items passed in `include`. By default, the separator is "\n\n";
- `asFiles`: if true, each include will be wrapped in a special template that also includes the file name and the file path. This is useful when the exact files are important for the context. It's useful with conjunction with `outputAsFiles` option.
- `role`: the default role that will be used for send all the messages (can be overridden in the message sub-files). This options specifies the type of the message (see `messages` in [API reference](https://platform.openai.com/docs/api-reference/chat)). Typically, a conversation is formatted with a `system` message first, followed by alternating `user` and `assistant` messages. Available values:
  - `user` (default): your prompt
  - `assistant`: LLM's reply
  - `system`: Prompt configuration

- `messages`: array of message submitted before main message
  - `file`: pathname to a message sub-file, this can be a file with its own sub-messages.
  - `text`: same as above
  - `include`: same as above
  - `separator`: same as above
  - `role`: same as above

- `outputDir`: the output directory where the results will be saved. The results will be saved in a new sub-folder each time the script is launched. This sub-folder will also include a file with the prompt. This helps to iterate the changes to the source files, while having the original prompt close to the results. If this option is not defined, the results will only be printed to the console.
- `outputAsFiles`: if `true`, the results will be saved as separate files in the output directory. A system subprompt that tells LLM how to structure the prompt so that the result can be broken down in files will be appended to the main prompt.
- `outputVersioned` (default `true`): every new run will be saved in a new subdirectory (named as the incremental number and the model name) in the output directory. If `false`, the result will be saved in the output directory directly. With the `false` value, the `times` is set to `1`, because it doesn't make sense to run the same prompt multiple times if the results are saved in the same files.