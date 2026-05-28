# Payment Setup for Subscription Plans

## Purpose

This document outlines how to accept payments for the new subscription plans:

- **Pro**: $5/month
- **Max 5x**: $25/month
- **Max 20x**: $50/month

The goal is to make billing straightforward, recurring, and easy to sync with the customer portal.

## Recommended Payment Flow

### 1. Use Stripe subscriptions

Stripe is the most direct fit because the customer portal already stores:

- `stripeCustomerId`
- `stripePriceId`
- `Payment` records
- plan assignments on the `User` model

That means the cleanest implementation is:

1. create Stripe products for Pro, Max 5x, and Max 20x
2. create recurring monthly prices
3. store the Stripe price IDs on the corresponding plan rows
4. create checkout sessions for new subscribers
5. listen to webhooks for billing state changes

## Stripe Objects to Create

### Products

Create three products:

- `Pro`
- `Max 5x`
- `Max 20x`

### Prices

Create monthly recurring prices:

- `pro_monthly` → `500` cents
- `max_5x_monthly` → `2500` cents
- `max_20x_monthly` → `5000` cents

Store the resulting Stripe price IDs in [`schema.prisma`](../customer-portal/prisma/schema.prisma:37) on the `Plan` rows.

## Subscription Lifecycle

### New customer

1. user selects a plan on the pricing page
2. backend creates a Stripe Checkout Session
3. customer completes payment
4. Stripe emits a successful checkout webhook
5. portal creates or updates the user subscription
6. user plan changes to Pro, Max 5x, or Max 20x

### Renewal

1. Stripe invoices the customer
2. payment succeeds
3. webhook confirms active subscription remains valid
4. quota and plan state stay active

### Cancellation

1. customer cancels in Stripe or portal
2. webhook marks subscription as canceled
3. plan reverts to free at period end or immediately, depending on policy

## Webhook Events to Handle

At minimum, handle:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Database Writes

The portal should update:

- `User.stripeCustomerId`
- `User.planId`
- `Payment` records
- subscription status fields if present

The existing [`Payment`](../customer-portal/prisma/schema.prisma:68) model is a good place to keep a normalized transaction history.

## Plan Configuration

Each plan row should include:

- monthly price in cents
- request quotas
- Stripe price ID
- feature flags for access level

For example:

- Pro → `priceCents = 500`
- Max 5x → `priceCents = 2500`
- Max 20x → `priceCents = 5000`

## Checkout UX

The pricing page should:

- show plan cards with monthly price
- show Anthropic-equivalent price crossed out
- show included usage limits
- show model family access
- route the user to Stripe checkout

## Portal Sync Strategy

After a successful payment:

1. persist the subscription state in the customer portal database
2. reflect the plan in the user dashboard
3. propagate plan identity to the gateway so rate limiting can read it
4. refresh any cached quota state

## Billing Portal

Add a customer billing portal link so users can:

- update card details
- cancel subscriptions
- view invoices
- switch plans

## Recommended Implementation Order

1. create Stripe products and prices
2. seed Pro, Max 5x, and Max 20x plan records
3. implement checkout session creation
4. implement webhook handlers
5. update plan assignment logic
6. connect plan changes to the gateway quota layer
7. surface billing status in the UI

## Operational Concerns

- verify webhooks in all environments
- keep plan and Stripe price IDs synchronized
- avoid granting paid access until the first successful checkout event is confirmed
- revoke or downgrade access when billing fails or is canceled

## Summary

Use Stripe subscriptions, store the Stripe price identifiers on the plan rows, and drive access from webhooks so billing state and quota enforcement stay in sync.
