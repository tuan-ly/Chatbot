// routes/api/upload/+server.ts
import { supabase } from '$lib/supabaseClient';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

export async function POST(event: RequestEvent) {
	try {
		const formData = await event.request.formData();
		const uploadedFiles = [];
		console.log('formData', formData);
		for (const [key, file] of formData.entries()) {
			if (file instanceof File) {
				const fileExt = file.name.split('.').pop();
				const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
				const filePath = `uploads/${fileName}`;

				const { data, error } = await supabase.storage.from('attachments').upload(filePath, file);

				if (error) throw error;

				const { data: publicUrl } = supabase.storage.from('attachments').getPublicUrl(filePath);

				uploadedFiles.push({
					name: file.name,
					type: file.type,
					size: file.size,
					url: publicUrl.publicUrl
				});
			}
		}

		return json(uploadedFiles);
	} catch (error) {
		console.error('Upload error:', error);
		return new Response(JSON.stringify({ error: 'Upload failed' }), {
			status: 500
		});
	}
}
