export type FileResult = {
    messages: APIMessages;
    baseDir?: string;
    outputDir?: string;
    outputVersioned?: boolean;
    outputAsFiles?: boolean;
};

export type FileMessageConfig = {
    messages: MessageConfig[];
    baseDir?: string;
    outputDir?: string;
    outputAsFiles?: boolean;
    outputVersioned?: boolean;
}

export type MessageConfig = MessageFileConfig | MessageTextConfig | MessageIncludeConfig;

export type MessageFileConfig = {
    file: string,
    role?: string,
}

export type MessageTextConfig = {
    text: string,
} & Partial<MessageIncludeConfig>;

export type MessageIncludeConfig = {
    include: string[],
    separator?: string,
    asFiles?: boolean,
    role?: string,
}

export type APIMessages = APIMessage[];

export interface APIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export type ApiResult = string;