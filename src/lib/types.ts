export interface Message {
	id: string;
	conversation_id: string;
	role: 'user' | 'assistant';
	content: string;
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
