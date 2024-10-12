// lib/messageHandler.ts
// import fs from 'fs';
// import path from 'path';
import { supabase } from '$lib/supabaseClient';
import type {
	OpenAIMessage,
	Message,
	ContentItem,
	TextContent,
	ImageContent,
	AudioContent
} from '$lib/types';

export class MessageHandler {
	static async saveMessage(
		conversation_id: string,
		role: 'user' | 'assistant',
		content: ContentItem[],
		metadata?: Record<string, any>
	): Promise<Message | null> {
		try {
			// Validate content structure
			if (!content.every(this.validateContentItem)) {
				throw new Error('Invalid content structure');
			}

			const { data, error } = await supabase
				.from('messages')
				.insert({
					conversation_id,
					role,
					content,
					metadata
				})
				.select()
				.single();

			if (error) throw error;
			return data as Message;
		} catch (error) {
			console.error('Error saving message:', error);
			return null;
		}
	}

	private static validateContentItem(item: ContentItem): boolean {
		switch (item.type) {
			case 'text':
				return (
					typeof (item as TextContent).text === 'string' && (item as TextContent).text.length > 0
				);
			case 'image':
				const image = item as ImageContent;
				return (
					image?.source?.data &&
					typeof image.source.data === 'string' &&
					image.source.data.length > 0 &&
					image.source.media_type &&
					typeof image.source.media_type === 'string'
				);
			case 'audio':
				const audio = item as AudioContent;
				return (
					audio?.source?.data &&
					typeof audio.source.data === 'string' &&
					audio.source.data.length > 0 &&
					audio.source.media_type &&
					typeof audio.source.media_type === 'string'
				);
			default:
				return false;
		}
	}

	private static async uploadWithRetry(
		file: File,
		filePath: string,
		options: {
			maxAttempts?: number;
			timeoutMs?: number;
		} = {}
	) {
		const { maxAttempts = 3, timeoutMs = 30 * 1000 } = options;
		let attempt = 0;

		while (attempt < maxAttempts) {
			try {
				const uploadPromise = supabase.storage.from('attachments').upload(filePath, file, {
					upsert: false,
					contentType: file.type,
					cacheControl: '3600'
				});

				// Create a timeout promise
				const timeoutPromise = new Promise((_, reject) => {
					setTimeout(() => reject(new Error('Upload timeout')), timeoutMs);
				});

				// Race between upload and timeout
				const { data, error } = (await Promise.race([uploadPromise, timeoutPromise])) as any;

				if (error) throw error;
				return data;
			} catch (error) {
				attempt++;
				if (attempt === maxAttempts) throw error;
				// Wait before retrying (exponential backoff)
				await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
			}
		}
	}

	static async processUploadedFiles(files: File[]): Promise<ContentItem[]> {
		const {
			data: { session },
			error: authError
		} = await supabase.auth.getSession();
		if (authError || !session) {
			throw new Error('Authentication required for file uploads');
		}

		const content: ContentItem[] = [];

		for (const file of files) {
			try {
				// const fileExt = file.name.split('.').pop();
				// const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
				// const filePath = `${session.user.id}/${fileName}`;

				// // Upload with retry logic
				// await this.uploadWithRetry(file, filePath);

				// Get public URL
				// const { data: publicUrl } = supabase.storage.from('attachments').getPublicUrl(filePath);

				// Process the file into a content item
				const contentItem = await this.handleDocumentAttachment(file);
				content.push(contentItem);
			} catch (error) {
				console.error(`Error uploading file ${file.name}:`, error);
				throw error;
			}
		}

		return content;
	}
	// private static encodeImageToBase64(imagePath) {
	// 	const image = fs.readFileSync(path.resolve(imagePath));
	// 	return image.toString('base64');
	// }

	private static fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = (error) => reject(error);
		});
	}

	private static async handleDocumentAttachment(file: File): Promise<ContentItem> {
		try {
			if (file.type.startsWith('text/')) {
				const textContent = await file.text();
				return {
					type: 'text',
					text: textContent
				} as TextContent;
			} else if (file.type.startsWith('image/')) {
				return await this.createImageContent(file);
			} else if (file.type.startsWith('audio/')) {
				return await this.createAudioContent(file);
			} else {
				throw new Error('Unsupported file type');
			}
		} catch (error) {
			throw new Error(`Error handling document attachment: ${error.message}`);
		}
	}

	private static async createImageContent(file: File): Promise<ImageContent> {
		const base64Data = await this.fileToBase64(file);
		return {
			type: 'image',
			source: {
				type: 'base64',
				media_type: file.type,
				data: base64Data
			},
			alt_text: file.name
		};
	}

	private static async createAudioContent(file: File): Promise<AudioContent> {
		const base64Data = await this.fileToBase64(file);
		return {
			type: 'audio',
			audio: {
				source: {
					type: 'base64',
					media_type: file.type,
					data: base64Data
				}
				// Optionally, you can add a speech-to-text transcription here
				// transcript: await this.transcribeAudio(file)
			}
		};
	}

	static formatMesssages(messages: Message[], model: string): string {
		if (model === 'claude-3-5-sonnet-20240620') {
			return MessageHandler.translateMessageToClaude(messages);
		} else {
			return MessageHandler.translateMessageToOpenAI(messages);
		}
	}

	// static formatMesssage(message: Message, model: string): string {
	// 	if (model === 'claude-3-5-sonnet-20240620') {
	// 		return MessageHandler.translateMessageToClaude(message);
	// 	} else {
	// 		return MessageHandler.translateMessageToOpenAI(message);
	// 	}
	// }

	static translateMessageToOpenAI(messages: Message[]): any {
		const messageArray: OpenAIMessage[] = [];
		messages.map((message) => {
			message.content.map((item) => {
				switch (item.type) {
					case 'text':
						messageArray.push({
							role: message.role,
							content: (item as TextContent).text
						});
						break;
					case 'image':
						// OpenAI might not support images directly, so handle accordingly
						messageArray.push({
							role: message.role,
							content: (item as ImageContent).source.data
						});
						break;
					// case 'audio':
					// 	// OpenAI might not support audio directly, so handle accordingly
					// 	return { type: item.type, audio: (item as AudioContent).source.data };
					default:
						return '';
				}
			});

			// messageArray.push(openAIMessage);
		});

		return messageArray;
	}
	static translateMessageToOpenAI_newSchema(messages: Message[]): any {
		const messageArray: OpenAIMessage[] = [];
		messages.map((message) => {
			const openAIMessage = {
				role: message.role,
				content: message.content.map((item) => {
					switch (item.type) {
						case 'text':
							return { type: 'text', text: (item as TextContent).text };

						case 'image':
							// OpenAI might not support images directly, so handle accordingly
							return {
								type: 'image_url',
								image_url: { url: (item as ImageContent).source.data }
							};
						// case 'audio':
						// 	// OpenAI might not support audio directly, so handle accordingly
						// 	return { type: item.type, audio: (item as AudioContent).source.data };
						default:
							return '';
					}
				})
			};

			messageArray.push(openAIMessage);
		});

		return messageArray;
	}
	// static translateFromOpenAI(response: any): Message {
	// 	// Assume response has a 'content' field with text
	// 	const textContent: TextContent = {
	// 		type: 'text',
	// 		text: response.content
	// 	};
	// 	return {
	// 		conversation_id: 'some_conversation_id', // You need to provide the actual ID
	// 		role: 'assistant',
	// 		content: [textContent]
	// 	};
	// }

	static translateMessageToClaude(messages: Message[]): any {
		const messagesArray: any = [];
		messages.map((message) => {
			const claudeMessage = {
				role: message.role,
				content: message.content.map((item) => {
					switch (item.type) {
						case 'text':
							return { type: 'text', text: (item as TextContent).text };
						case 'image':
							return {
								type: 'image',
								source: {
									type: (item as ImageContent).source.type,
									data: (item as ImageContent).source.data.split(',')[1],
									media_type: (item as ImageContent).source.media_type
								}
							};
						case 'audio':
							return {
								type: 'audio',
								source: (item as AudioContent).source
							};
						default:
							return null;
					}
				})
			};

			messagesArray.push(claudeMessage);
		});
		return messagesArray;
	}

	// static translateFromClaude(response: any): Message {
	// 	// Assume response has a 'content' array
	// 	const content: ContentItem[] = response.content
	// 		.map((item) => {
	// 			switch (item.type) {
	// 				case 'text':
	// 					return {
	// 						type: 'text',
	// 						text: item.text
	// 					} as TextContent;
	// 				case 'image':
	// 					return {
	// 						type: 'image',
	// 						image: item.image
	// 					} as ImageContent;
	// 				case 'audio':
	// 					return {
	// 						type: 'audio',
	// 						audio: item.audio
	// 					} as AudioContent;
	// 				default:
	// 					return null;
	// 			}
	// 		})
	// 		.filter(Boolean);

	// 	return {
	// 		conversation_id: 'some_conversation_id', // You need to provide the actual ID
	// 		role: 'assistant',
	// 		content
	// 	};
	// }
}
