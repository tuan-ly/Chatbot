// routes/api/upload/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { MessageHandler } from '$lib/messageHandler';

export async function POST(event: RequestEvent) {
	try {
		const formData = await event.request.formData();
		const files: File[] = [];

		for (const [_, file] of formData.entries()) {
			if (file instanceof File) {
				files.push(file);
			}
		}

		const contents = await MessageHandler.processUploadedFiles(files);

		return json(
			contents.map((content) => ({
				name: files[0].name,
				type: files[0].type,
				size: files[0].size,
				url: content.image_url || content.file_url
			}))
		);
	} catch (error) {
		console.error('Upload error:', error);
		return new Response(JSON.stringify({ error: 'Upload failed' }), {
			status: 500
		});
	}
}
