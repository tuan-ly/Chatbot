// lib/messageHandler.ts
import { supabase } from '$lib/supabaseClient';
import type { Message, ContentItem_Old } from '$lib/types';

export class MessageHandler {
	static async saveMessage(
		conversation_id: string,
		role: 'user' | 'assistant',
		contents: ContentItem_Old[]
	): Promise<Message | null> {
		try {
			// Validate content structure
			if (!contents.every(this.validateContentItem_old)) {
				throw new Error('Invalid content structure');
			}

			const { data, error } = await supabase
				.from('messages')
				.insert({
					conversation_id,
					role,
					content: contents
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

	// private static validateContentItem(item: ContentItem): boolean {
	// 	switch (item.type) {
	// 		case 'text':
	// 			return typeof item.text === 'string' && item.text.length > 0;
	// 		case 'image_url':
	// 			return typeof item.image_url.url === 'string' && item.image_url.url.length > 0;
	// 		case 'file_url':
	// 			return typeof item.file_url.url === 'string' && item.file_url.url.length > 0;
	// 		default:
	// 			return false;
	// 	}
	// }
	private static validateContentItem_old(item: ContentItem_Old): boolean {
		switch (item.type) {
			case 'text':
				return typeof item.text === 'string' && item.text.length > 0;
			case 'image':
				return true;
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
	static async processUploadedFiles(files: File[]): Promise<ContentItem_Old[]> {
		const {
			data: { session },
			error: authError
		} = await supabase.auth.getSession();
		if (authError || !session) {
			throw new Error('Authentication required for file uploads');
		}

		const contents: ContentItem_Old[] = [];

		for (const file of files) {
			try {
				const fileExt = file.name.split('.').pop();
				const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
				const filePath = `${session.user.id}/${fileName}`;
				console.log('file', file);
				// Upload with retry logic
				await this.uploadWithRetry(file, filePath);

				// Get public URL
				const { data: publicUrl } = supabase.storage.from('attachments').getPublicUrl(filePath);

				const content = await this.handleDocumentAttachment(file);
				console.log('content', content);
				contents.push(content);
			} catch (error) {
				console.error(`Error uploading file ${file.name}:`, error);
				throw error;
			}
		}

		return contents;
	}

	private static fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = (error) => reject(error);
		});
	}
	private static handleDocumentAttachment = async (file): Promise<ContentItem_Old> => {
		console.log('file', file);
		try {
			if (file.type.startsWith('text/')) {
				return { type: 'text', text: file.toString('utf-8') };
			} else if (file.type.startsWith('image/')) {
				return await this.createImageAttachment(file, file.type);
			} else {
				return null;
			}
		} catch (error) {
			throw new Error(`Error handling document attachment: ${error.message}`);
		}
	};

	private static createImageAttachment = async (
		fileContent,
		fileType
	): Promise<ContentItem_Old> => {
		const base64Data = await this.fileToBase64(fileContent);
		return {
			type: 'image',

			image: base64Data.split(',')[1]
		};
	};
}
// source: {
// 			type: 'base64',
// 			media_type: fileType || 'image/jpeg',
// 			data: base64Data.split(',')[1]
// 		}
