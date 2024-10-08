import Stripe from 'stripe';
import supabaseAdmin from '$lib/supabaseAdmin';

const stripe = new Stripe('<YOUR_STRIPE_SECRET_KEY>');
export async function POST({ request }) {
	return new Response(`Webhook Error: ${err.message}`, { status: 400 });
}

// export async function POST({ request }) {
// 	const signature = request.headers.get('stripe-signature');
// 	const body = await request.text();

// 	let event;

// 	try {
// 		event = stripe.webhooks.constructEvent(body, signature, '<YOUR_STRIPE_WEBHOOK_SECRET>');
// 	} catch (err) {
// 		console.error(`Webhook signature verification failed.`, err.message);
// 		return new Response(`Webhook Error: ${err.message}`, { status: 400 });
// 	}

// 	// Handle the checkout.session.completed event
// 	if (event.type === 'checkout.session.completed') {
// 		const session = event.data.object;
// 		const user_id = session.metadata.user_id;
// 		const plan_id = session.metadata.plan_id;

// 		// Fetch the plan details
// 		const { data: plan } = await supabaseAdmin
// 			.from('payment_plans')
// 			.select('credits')
// 			.eq('id', plan_id)
// 			.single();

// 		if (plan) {
// 			// Update user's credits
// 			await supabaseAdmin.rpc('increment_user_credits', {
// 				user_id,
// 				amount: plan.credits
// 			});

// 			// Record the credit transaction
// 			await supabaseAdmin.from('credit_transactions').insert({
// 				user_id,
// 				amount: plan.credits,
// 				description: `Purchased ${plan.credits} credits`
// 			});
// 		}
// 	}

// 	return new Response(null, { status: 200 });
// }
