import { json } from '@sveltejs/kit';
import { createSupabaseWithToken } from '$lib/supabaseClient.js';
import { AI_URL } from '$lib/config';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { conversation_id, messages, model } = await request.json();

	// Get the Authorization header
	const authorization = request.headers.get('Authorization');
	if (!authorization) {
		return json({ error: 'No authorization header' }, { status: 401 });
	}

	const token = authorization.replace('Bearer ', '');
	if (!token) {
		return json({ error: 'No token provided' }, { status: 401 });
	}
	const supabase = createSupabaseWithToken(token);

	// Validate the token and get the user ID
	const {
		data: { user },
		error: sessionError
	} = await supabase.auth.getUser(token);
	// console.log('user', user);

	if (sessionError || !user) {
		return json({ error: 'Invalid session' }, { status: 401 });
	}

	const userId = user.id;

	if (!messages || messages.length === 0) {
		return json({ error: 'No messages provided' }, { status: 400 });
	}

	if (!userId) {
		return json({ error: 'User not authenticated' }, { status: 401 });
	}

	// Check user's credit balance
	const { data: profile, error: profileError } = await supabase
		.from('profiles')
		.select('credits')
		.eq('id', userId)
		.single();

	console.log('profile', profile);

	if (profileError) {
		console.error('Error fetching user profile:', profileError);
		return json({ error: 'Failed to fetch user profile' }, { status: 500 });
	}

	// Proceed to get AI response
	const aiResponse = await getAIResponse(messages, model);
	// console.log('aiResponse', aiResponse);
	if (aiResponse.ok === false) {
		return json({ error: aiResponse.error }, { status: 500 });
	}
	let userCredits = profile?.credits || 0;

	// Assume each AI request costs 1 credit (adjust as needed)
	const creditCost = Math.floor(aiResponse.execution_cost * 100) || 1;

	if (userCredits < creditCost) {
		return json({ error: 'Insufficient credits' }, { status: 403 });
	}
	// Begin transaction to deduct credits and record the transaction
	const { error: transactionError } = await supabase.rpc('deduct_credits', {
		user_id: userId,
		amount: creditCost
	});

	if (transactionError) {
		console.error('Error deducting credits:', transactionError);
		return json({ error: 'Failed to deduct credits' }, { status: 500 });
	}

	return json({ result: aiResponse.result, creditCost: creditCost });
};

async function getAIResponse(
	messages: Array<{ role: string; content: string }>,
	model: string
): Promise<{ result: string } | { error: string }> {
	try {
		const response = await fetch(AI_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ messages, model })
		});

		if (!response.ok) {
			throw new Error(`AI server error: ${response.status}`);
		}

		const data = await response.json();
		// console.log('data', data);
		return data;
	} catch (error) {
		console.error('Error in getAIResponse:', error);
		return { error: 'Failed to process AI request' };
	}
}
