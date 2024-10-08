import { json } from '@sveltejs/kit';
import Stripe from 'stripe';
import { supabaseAdmin } from '$lib/supabaseAdmin'; // Admin client with service_role key

const stripe = new Stripe('<YOUR_STRIPE_SECRET_KEY>');

export async function POST({ request, locals }) {
	const user = locals.user;
	if (!user) {
		return new Response('Unauthorized', { status: 401 });
	}

	const { plan_id } = await request.json();

	// Fetch the payment plan from Supabase
	const { data: plan, error } = await supabaseAdmin
		.from('payment_plans')
		.select('*')
		.eq('id', plan_id)
		.single();

	if (error || !plan) {
		return json({ error: 'Invalid Plan' }, { status: 400 });
	}

	// Create Stripe Checkout session
	const session = await stripe.checkout.sessions.create({
		payment_method_types: ['card'],
		mode: 'payment',
		line_items: [
			{
				price: plan.stripe_price_id,
				quantity: 1
			}
		],
		success_url: 'https://yourdomain.com/purchase-success',
		cancel_url: 'https://yourdomain.com/purchase-canceled',
		customer_email: user.email,
		metadata: {
			user_id: user.id,
			plan_id: plan.id
		}
	});

	return json({ sessionId: session.id });
}
