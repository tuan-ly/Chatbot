import { json } from '@sveltejs/kit';
import { AI_URL, models } from '$lib/config';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const { messageArray, model } = await request.json();

		// Process the messages and model here
		// Example: Make API call to AI service
		const response = await fetch(AI_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
				// Add any other necessary headers (e.g., API key)
			},
			body: JSON.stringify({ messages: messageArray, model })
		});

		const data = await response.json();

		return json(data);
	} catch (error) {
		console.error('Error:', error);
		return json({ error: 'Failed to process request' }, { status: 500 });
	}
};
