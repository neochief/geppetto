export type AIJob = {
    messages: APIMessages,
    times: number,
    outputFile?: string,
    outputDir: string,
    outputVersioned: boolean,
    outputAsFiles: boolean,
    editInPlace: boolean,
}

export type FileResult = {
    messages: APIMessages;
    taskBaseDir?: string;
    outputFile?: string,
    outputDir?: string;
    outputVersioned?: boolean;
    outputAsFiles?: boolean;
    editInPlace?: boolean;
    times?: number;
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
    editInPlace?: boolean,
    includesAsFiles?: boolean,
    role?: string,
}

export type APIMessages = APIMessage[];

export interface APIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export type ApiResult = string;