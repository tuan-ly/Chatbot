import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient.js';
import { AI_URL } from '$lib/config';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ fetch, request, locals }) => {
	const { conversation_id, messages, model, userId } = await request.json();
	console.log('messages', messages);
	if (!messages || messages.length === 0) {
		return json({ error: 'No messages provided' }, { status: 400 });
	}

	const aiResponse = await getAIResponse(messages, model, fetch);

	if ('error' in aiResponse) {
		return json({ error: aiResponse.error }, { status: 500 });
	}

	return json({ result: aiResponse.result });
};

async function getAIResponse(
	messageArray: Array<{ role: string; content: string }>,
	model: string,
	fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
): Promise<{ result: string; credit: number } | { error: string }> {
	try {
		const response = await fetch(AI_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ messages: messageArray, model })
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();

		console.log('Data:', data);
		return {
			result: data.result,
			credit: data.execution_cost
		};
	} catch (error) {
		console.error('Error in getAIResponse:', error);
		return { error: 'Failed to process request' };
	}
}
