export type FileResult = {
    messages: APIMessages;
    output?: string;
};

export type MessageConfig = (MessageFileConfig | MessageTextConfig | MessageIncludeConfig) & { messages: MessageConfig[] };

export type MessageFileConfig = {
    file: string,
    role?: string,
}

export type MessageTextConfig = {
    text: string,
} & Partial<MessageIncludeConfig>;

export type MessageIncludeConfig = {
    include: (string | { file: string })[],
    includeSeparator?: string,
    role?: string,
}

export type APIMessages = APIMessage[];

export interface APIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export type ApiResult = string;