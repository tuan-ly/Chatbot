// lib/messageHandler.ts
import { supabase } from '$lib/supabaseClient';
import type { Message, ContentItem } from '$lib/types';

export class MessageHandler {
	static async saveMessage(
		conversation_id: string,
		role: 'user' | 'assistant',
		contents: ContentItem[]
	): Promise<Message | null> {
		try {
			// Validate content structure
			if (!contents.every(this.validateContentItem)) {
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

	private static validateContentItem(item: ContentItem): boolean {
		switch (item.type) {
			case 'text':
				return typeof item.text === 'string' && item.text.length > 0;
			case 'image_url':
				return typeof item.image_url.url === 'string' && item.image_url.url.length > 0;
			case 'file_url':
				return typeof item.file_url.url === 'string' && item.file_url.url.length > 0;
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

		const contents: ContentItem[] = [];

		for (const file of files) {
			try {
				const fileExt = file.name.split('.').pop();
				const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
				const filePath = `${session.user.id}/${fileName}`;

				// Upload with retry logic
				await this.uploadWithRetry(file, filePath);

				// Get public URL
				const { data: publicUrl } = supabase.storage.from('attachments').getPublicUrl(filePath);

				const content = {
					type: file.type.startsWith('image/') ? 'image_url' : 'file_url',
					[file.type.startsWith('image/') ? 'image_url' : 'file_url']: { url: publicUrl.publicUrl }
				};
				console.log('content', content);
				contents.push(content);
			} catch (error) {
				console.error(`Error uploading file ${file.name}:`, error);
				throw error;
			}
		}

		return contents;
	}
}
