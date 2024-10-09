export type ContentItem = {
	type: 'text' | 'image_url' | 'file_url';
	text?: string;
	image_url?: string;
	file_url?: string;
};
export type ContentItem_Old = {
	type: 'text' | 'image';
	text?: string;
	source?: {
		type: string;
		media_type: string;
		data: string;
	};
};
export interface Message {
	id: string;
	conversation_id: string;
	role: 'user' | 'assistant';
	content: ContentItem[];
	created_at: string;
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
