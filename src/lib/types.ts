export interface Message {
	conversation_id: string;
	role: 'user' | 'assistant';
	content: ContentItem[];
	image?: string;
	metadata?: Record<string, any>;
}

export interface OpenAIMessage {
	role: 'user' | 'assistant';
	content?: string;
	image?: string;
	metadata?: Record<string, any>;
}

export type ContentItem = TextContent | ImageContent | AudioContent;

export interface BaseContent {
	type: string;
}

export interface TextContent extends BaseContent {
	type: 'text';
	text: string;
}

export interface ImageContent extends BaseContent {
	type: 'image';
	source: {
		type: 'url' | 'base64';
		media_type: string; // e.g., 'image/png'
		data: string; // URL or base64 data
	};
	alt_text?: string;
}

export interface AudioContent extends BaseContent {
	type: 'audio';
	source: {
		type: 'url' | 'base64';
		media_type: string; // e.g., 'audio/mp3'
		data: string; // URL or base64 data
	};
	transcript?: string;
}
export interface Conversation {
	id: string;
	title: string;
	user_id: string;
	created_at: string;
	messages: Message[];
}

export interface Profile {
	id: string;
	credits: number;
}
