import OpenAI from "openai/index";
import Anthropic from '@anthropic-ai/sdk';
import { APIMessages, ApiResult } from "./types";
import { MessageParam } from "@anthropic-ai/sdk/src/resources/messages";

export const allSupportedModels = {
    "anthropic": ["claude-opus-4-20250514", "claude-sonnet-4-20250514"],
    "openai": ['gpt-4.1-2025-04-14'],
    "o3": ['o3-2025-04-16'],
}
export const supportedModels = Object.values(allSupportedModels).reduce((acc, val) => acc.concat(val), []);
export const defaultModel = supportedModels[0];

export function initializeApi(model: string) {
    if (!supportedModels.includes(model)) {
        throw `Error: Model ${ model } is not supported. Please use one of the following models: ${ supportedModels.join(', ') }`;
    }

    if (allSupportedModels.openai.includes(model) || allSupportedModels.o3.includes(model)) {
        if (!process.env.OPENAI_API_KEY) {
            throw "Error: OPENAI_API_KEY environment variable is not set.";
        }
        return new OpenaiClient();
    }

    if (allSupportedModels.anthropic.includes(model)) {
        if (!process.env.ANTHROPIC_API_KEY) {
            throw "Error: ANTHROPIC_API_KEY environment variable is not set.";
        }
        return new AnthropicClient();
    }
}


export interface APIClient {
    call(messages: APIMessages, model: string, times: number): Promise<ApiResult>[];
}

class OpenaiClient implements APIClient {
    private client: OpenAI;

    constructor() {
        this.client = new OpenAI();
    }

    call(messages: APIMessages, model: string, times: number): Promise<ApiResult>[] {
        const promises = [] as Promise<ApiResult>[];
        for (let i = 0; i < times; i++) {
            promises.push(new Promise((resolve, reject) => {
                this.client.chat.completions.create({
                    messages: messages,
                    model: model,
                }).then((response) => {
                    resolve(response.choices[0].message.content);
                }).catch((error) => {
                    reject(error);
                });
            }));
        }
        return promises;
    }
}

class AnthropicClient implements APIClient {
    private client: Anthropic;
    private retriesWhenHitRateLimit = 10;
    private retryInterval = 1000;

    constructor() {
        this.client = new Anthropic();
    }

    call(messages: APIMessages, model: string, times: number): Promise<ApiResult>[] {
        const promises = [];
        for (let i = 0; i < times; i++) {

            const messagesWithoutSystemRole = messages.map(item => {
                return {
                    content: item.content,
                    role: ['user', 'assistant'].includes(item.role) ? item.role : 'user',
                };
            });

            const messagesWithConsequentUserMessagesSquashed = messagesWithoutSystemRole.reduce((acc, val) => {
                if (acc.length > 0 && acc[acc.length - 1].role === 'user' && val.role === 'user') {
                    acc[acc.length - 1].content += "\n\n" + val.content;
                } else {
                    acc.push(val);
                }
                return acc;
            }, []);

            const anthropicMessages = messagesWithConsequentUserMessagesSquashed as MessageParam[];

            promises.push(new Promise((resolve, reject) => {

                let call = () => {
                    return this.client.messages.create({
                            max_tokens: 4096,
                            messages: anthropicMessages,
                            model: model,
                        },
                        // We do our own retries, because default ones don't wait between retries.
                        {maxRetries: 0});
                };

                let then = (response) => {
                    resolve(response.content[0].text);
                };

                let catchFn = (attempt: number) => {
                    if (this.retriesWhenHitRateLimit > 0 && attempt < this.retriesWhenHitRateLimit) {
                        return (error) => {
                            if (error && ([408, 409, 429].includes(error.status) || error.status >= 500)) {
                                console.log(`Worker's #${ i + 1 } attempt ${ attempt + 1 } failed (server returned ${ error.status } error). Retrying in ${ this.retryInterval }ms...`);
                                setTimeout(() => {
                                    call().then(then).catch(catchFn(attempt + 1));
                                }, this.retryInterval);
                            } else {
                                reject(error);
                            }
                        };
                    } else {
                        return (error) => {
                            reject(error);
                        };
                    }
                }

                call().then(then).catch(catchFn(0));
            }));
        }
        return promises;
    }
}
