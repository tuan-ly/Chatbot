import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient.js';
import { AI_URL } from '$lib/config';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ fetch, request, locals }) => {
	// const session = await locals.getSession();

	// if (!session) {
	// 	return new Response('Unauthorized', { status: 401 });
	// }
	// const user = session.user;

	const { conversation_id, messages, model, userId } = await request.json();
	console.log('messages', messages);
	if (!messages || messages.length === 0) {
		return json({ error: 'No messages provided' }, { status: 400 });
	}
	// Fetch user's current credits
	// const { data: profile } = await supabase
	// 	.from('profiles')
	// 	.select('credits')
	// 	.eq('id', userId)
	// 	.single();
	// just forget the user credit, I want it to work now
	// if (!profile || profile.credits <= 0) {
	// 	return json({ error: 'Insufficient credits' }, { status: 400 });
	// }

	// Interact with the AI model
	const aiResponse = await getAIResponse(messages, model, fetch);

	if ('error' in aiResponse) {
		return json({ error: aiResponse.error }, { status: 500 });
	}

	// const creditCost = aiResponse.credit || 1; // Default to 1 if credit is not provided

	// Check if user has enough credits
	// if (profile.credits < creditCost) {
	// 	return json({ error: 'Insufficient credits' }, { status: 400 });
	// }

	// Deduct credits and save messages in a transaction
	// const { error } = await supabase
	// 	.from('profiles')
	// 	.update({
	// 		credits: profile.credits - creditCost
	// 	})
	// 	.eq('id', userId);

	// 	if (error) {
	// 		console.error('Error deducting credits:', error);
	// 		return json({ error: 'Error processing your request' }, { status: 500 });
	// 	}

	// 	// Record the messages
	// 	const { error: messageError } = await supabase.from('messages').insert([
	// 		{
	// 			conversation_id,
	// 			role: 'user',
	// 			content: messages[messages.length - 1].content
	// 		},
	// 		{
	// 			conversation_id,
	// 			role: 'assistant',
	// 			content: aiResponse.result
	// 		}
	// 	]);

	// 	if (messageError) {
	// 		console.error('Error saving messages:', messageError);
	// 		return json({ error: 'Error saving messages' }, { status: 500 });
	// 	}

	// 	// Record the credit transaction
	// 	await supabase.from('credit_transactions').insert({
	// 		user_id: userId,
	// 		amount: -creditCost,
	// 		description: 'AI interaction'
	// 	});

	return json({ result: aiResponse.result });
};

/**
 * @param {Array<{role: string, content: string}>} messageArray
 * @param {string} model
 * @param {(input: RequestInfo, init?: RequestInit) => Promise<Response>} fetch
 * @returns {Promise<{result: string, credit: number} | {error: string}>}
 */
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
