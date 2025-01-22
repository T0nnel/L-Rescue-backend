/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Request, Response } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import { DiscountTier } from 'src/types';



@Injectable()
export class StripeService {
  private stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(
    private configService: ConfigService,
    private supabaseService: SupabaseService
  ) {
    const apiKey = this.configService.get('STRIPE_SECRET_KEY');
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is missing');
    }
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2024-12-18.acacia',
    });
    this.logger.debug('StripeService initialized');
  }

  async createCheckoutSession(
    basePrice: number,
    discountTier: DiscountTier | null,
    customerEmail: string,
    attorneyId: string
  ): Promise<Stripe.Response<Stripe.Checkout.Session> | Stripe.Response<Stripe.BillingPortal.Session>> {
    try {
      this.logger.debug('Creating checkout session', {
        customerEmail,
        attorneyId,
        basePrice,
        discountTier: JSON.stringify(discountTier),
      });

      if (!customerEmail || !attorneyId) {
        throw new Error('Missing required parameters');
      }

      const customers = await this.stripe.customers.list({
        email: customerEmail,
        limit: 1,
      });
      this.logger.debug(customerEmail, customers)

      let session: Stripe.Response<Stripe.BillingPortal.Session> | Stripe.Response<Stripe.Checkout.Session>;
      
      if (customers.data.length > 0) {
        const customerId = customers.data[0].id;
        this.logger.debug(`Found existing customer: ${customerId}`);

        const activeSubscriptions = await this.checkExistingSubscriptions(customerId);

        if (activeSubscriptions) {
          this.logger.debug('Customer has active subscriptions, creating billing portal session');
          session = await this.createBillingPortalSession(customerId);
        } else {
          this.logger.debug('Customer has no active subscriptions, creating new checkout session');
          session = await this.createInitialCheckoutSession(
            basePrice,
            discountTier,
            customerId,
            attorneyId
          );
        }
      } else {
        this.logger.debug('No existing customer found, creating new checkout session');
        session = await this.createInitialCheckoutSession(
          basePrice,
          discountTier,
          undefined,
          attorneyId
          
        );
      }

      return session;
    } catch (error) {
      this.logger.error('Error in createCheckoutSession:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  private calculateInitialPrice(basePrice: number, discountTier: DiscountTier | null): number {
    if (!discountTier) {
      return basePrice;
    }

    if (discountTier.secondYearDiscount > 0) {
      return Math.round(basePrice * (1 - discountTier.secondYearDiscount / 100));
    }

    if (discountTier.additionalDiscount) {
      return Math.round(basePrice * (1 - discountTier.additionalDiscount.percent / 100));
    }

    return basePrice;
  }

  private async createInitialCheckoutSession(
    basePrice: number,
    discountTier: DiscountTier | null,
    customerId?: string,
    attorneyId?: string,
  ): Promise<Stripe.Response<Stripe.Checkout.Session>> {
    try {
      this.logger.debug('Creating initial checkout session', {
        basePrice,
        discountTier,
        customerId,
        attorneyId,
      });

      const startDate = new Date();
      const trialEndDate = new Date(startDate);
      const trialMonths = discountTier?.trialMonths || 3;
      
      let targetMonth = trialEndDate.getMonth() + trialMonths;
      let targetYear = trialEndDate.getFullYear();
      
      if (targetMonth >= 12) {
          targetYear += Math.floor(targetMonth / 12);
          targetMonth = targetMonth % 12;
      }
      
      trialEndDate.setFullYear(targetYear);
      trialEndDate.setMonth(targetMonth);
      
      if (startDate.getDate() > trialEndDate.getDate()) {
          trialEndDate.setDate(0);
      }
      
      const trialPeriodDays = Math.ceil((trialEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      this.logger.debug(`Calculated trial period: ${trialPeriodDays} days`);

      if (!customerId) {
        const customer = await this.stripe.customers.create();
        customerId = customer.id;
        this.logger.debug(`Created new customer: ${customerId}`);
      }

      const initialPrice = this.calculateInitialPrice(basePrice, discountTier);
      this.logger.debug(`Calculated initial price: ${initialPrice}`);
      
      const initialPriceId = await this.createOrGetPrice(initialPrice, 'discount');
      this.logger.debug(`Retrieved initial price ID: ${initialPriceId}`);

      const metadata = {
        attorneyId,
        subscriptionData: JSON.stringify({
          discountTier,
          originalBasePrice: basePrice,
          trialMonths
        }),
      };

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer: customerId,
        line_items: [
          {
            price: initialPriceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        subscription_data: {
          trial_period_days: trialPeriodDays,
        },
        success_url: `${this.configService.get('FRONTEND_URL')}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.configService.get('FRONTEND_URL')}/cancel`,
        metadata,
      });

      this.logger.debug('Successfully created checkout session', {
        sessionId: session.id,
        customerId: session.customer,
      });

      return session;
    } catch (error) {
      this.logger.error('Error creating initial checkout session:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  private async createOrGetPrice(
    amount: number,
    type: 'base' | 'discount'
  ): Promise<string> {
    try {
      const lookup_key = `${type}_${amount}`;
      this.logger.debug(`Looking up price with key: ${lookup_key}`);

      const prices = await this.stripe.prices.list({
        lookup_keys: [lookup_key],
        active: true,
      });

      if (prices.data.length > 0) {
        this.logger.debug(`Found existing price: ${prices.data[0].id}`);
        return prices.data[0].id;
      }

      this.logger.debug('Creating new price');
      const newPrice = await this.stripe.prices.create({
        unit_amount: amount,
        currency: 'usd',
        recurring: { interval: 'month' },
        product: this.configService.get('STRIPE_PRODUCT_ID'),
        lookup_key: lookup_key,
      });

      this.logger.debug(`Created new price: ${newPrice.id}`);
      return newPrice.id;
    } catch (error) {
      this.logger.error('Error in createOrGetPrice:', {
        error: error.message,
        amount,
        type,
      });
      throw error;
    }
  }

  private async createSubscriptionSchedule(
    subscription: Stripe.Subscription,
    basePrice: number,
    discountTier: string | DiscountTier | null
): Promise<void> {
    try {
        this.logger.debug('Starting createSubscriptionSchedule with params:', {
            subscriptionId: subscription.id,
            basePrice,
            discountTier: typeof discountTier === 'string' ? discountTier : JSON.stringify(discountTier),
        });

        let parsedDiscountTier: DiscountTier | null;
        if (typeof discountTier === 'string') {
            try {
                parsedDiscountTier = JSON.parse(discountTier) as DiscountTier;
            } catch (e) {
                this.logger.error('Failed to parse discount tier:', e);
                throw new Error('Invalid discount tier format');
            }
        } else {
            parsedDiscountTier = discountTier;
        }

        if (!parsedDiscountTier) {
            this.logger.debug('No discount tier - updating subscription to full price');
            const fullPriceId = await this.createOrGetPrice(basePrice, 'base');
            await this.stripe.subscriptions.update(subscription.id, {
                items: [{
                    id: subscription.items.data[0].id, 
                    price: fullPriceId,
                }],
                proration_behavior: 'none'
            });
            return;
        }

        // Get the current subscription details
        const currentDate = Math.floor(Date.now() / 1000);
        const existingItemId = subscription.items.data[0].id;

        // Create phases array for storing the schedule
        const phases: Array<{
            price: string;
            iterations?: number;
            trial?: boolean;
        }> = [];
        
        const trialMonths = parsedDiscountTier.trialMonths || 0;

        // Calculate initial phase based on trial
        if (trialMonths > 0) {
            phases.push({
                price: subscription.items.data[0].price.id,
                iterations: trialMonths,
                trial: true
            });
        }

        if (parsedDiscountTier.secondYearDiscount > 0) {
            const discountedAmount = Math.round(basePrice * (1 - parsedDiscountTier.secondYearDiscount / 100));
            const discountedPriceId = await this.createOrGetPrice(discountedAmount, 'discount');

            phases.push({
                price: discountedPriceId,
                iterations: 12
            });

            const fullPriceId = await this.createOrGetPrice(basePrice, 'base');
            phases.push({
                price: fullPriceId
            });
        } else if (parsedDiscountTier.additionalDiscount) {
            const additionalDiscountAmount = Math.round(basePrice * (1 - parsedDiscountTier.additionalDiscount.percent / 100));
            const additionalDiscountPriceId = await this.createOrGetPrice(additionalDiscountAmount, 'discount');

            phases.push({
                price: additionalDiscountPriceId,
                iterations: parsedDiscountTier.additionalDiscount.months
            });

            const fullPriceId = await this.createOrGetPrice(basePrice, 'base');
            phases.push({
                price: fullPriceId
            });
        }

        // Update the subscription with the first phase and store the rest in metadata
        const firstPhase = phases[0];
        await this.stripe.subscriptions.update(subscription.id, {
            items: [{
                id: existingItemId, // Use existing subscription item ID
                price: firstPhase.price,
            }],
            trial_end: firstPhase.trial ? 
                currentDate + (trialMonths * 30 * 24 * 60 * 60) : 
                undefined,
            proration_behavior: 'none',
            metadata: {
                scheduled_phases: JSON.stringify(phases.slice(1)), 
                current_phase: '0'
            }
        });

        this.logger.debug('Successfully updated subscription with phased pricing plan');
    } catch (error) {
        this.logger.error('Failed to update subscription with phases:', {
            error: error.message,
            stack: error.stack,
            subscriptionId: subscription.id,
        });
        throw error;
    }
}

private async getPriceAmount(priceId: string): Promise<number> {
  try {
      const price = await this.stripe.prices.retrieve(priceId);
      return price.unit_amount || 0;
  } catch (error) {
      this.logger.error('Error retrieving price amount:', {
          error: error.message,
          priceId
      });
      return 0;
  }
}
 
  private async createInitialSubscriptionRecord(
    subscription: Stripe.Subscription,
    metadata: Record<string, string>
  ): Promise<void> {
    try {
      this.logger.debug('Creating initial subscription record', {
        subscriptionId: subscription.id,
        metadata: JSON.stringify(metadata),
      });

      if (!metadata.subscriptionData) {
        throw new Error('Missing subscription data in metadata');
      }

      const supabase = this.supabaseService.getClient();
      const subscriptionData = JSON.parse(metadata.subscriptionData);
      const discountTier = subscriptionData.discountTier;
      const basePrice = subscriptionData.originalBasePrice;
      
      if (!basePrice || typeof basePrice !== 'number') {
          throw new Error('Invalid base price in subscription data');
      }

      const trialEnd = new Date(subscription.trial_end * 1000);
      
      if (discountTier) {
          let nextPrice: number;
          let discountPercent: number;
          let remainingDiscountMonths: number;
          
          if (discountTier.secondYearDiscount > 0) {
              nextPrice = Math.round(basePrice * (1 - discountTier.secondYearDiscount / 100));
              discountPercent = discountTier.secondYearDiscount;
              remainingDiscountMonths = 12 ;
          } else if (discountTier.additionalDiscount) {
              nextPrice = Math.round(basePrice * (1 - discountTier.additionalDiscount.percent / 100));
              discountPercent = discountTier.additionalDiscount.percent;
              remainingDiscountMonths = discountTier.additionalDiscount.months;
          } else {
              nextPrice = basePrice;
              discountPercent = 0;
              remainingDiscountMonths = 0;
          }
          

          this.logger.debug('Inserting subscription record with discount', {
              nextPrice,
              discountPercent,
              remainingDiscountMonths,
          });

          await supabase
              .from('attorney_subscriptions')
              .insert({
                  attorneyId: metadata.attorneyId,
                  stripesubscriptionid: subscription.id, 
                  subscriptionStatus: 'trialing',
                  trialEndsAt: trialEnd,
                  basePrice,
                  currentPrice: 0,
                  nextPriceChange: trialEnd,
                  nextPrice,
                  originalBasePrice: basePrice,
                  discountPercent,
                  remainingDiscountMonths,
              });
      } else {
          this.logger.debug('Inserting subscription record without discount');
          await supabase
              .from('attorney_subscriptions')
              .insert({
                  attorneyId: metadata.attorneyId,
                  stripesubscriptionid: subscription.id, 
                  subscriptionStatus: 'trialing',
                  trialEndsAt: trialEnd,
                  basePrice,
                  currentPrice: 0,
                  nextPriceChange: trialEnd,
                  nextPrice: basePrice,
                  originalBasePrice: basePrice,
                  discountPercent: 0,
                  remainingDiscountMonths: 0,
              });
      }
      this.logger.debug('Successfully created subscription record');
  } catch (error) {
      this.logger.error('Error creating subscription record:', {
          error: error.message,
          subscriptionId: subscription.id,
      });
      throw error;
  }
}

private async checkExistingSubscriptions(customerId: string): Promise<boolean> {
  try {
    this.logger.debug(`Checking existing subscriptions for customer: ${customerId}`);
    const statuses: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due'];
    
    for (const status of statuses) {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status,
        limit: 1,
      });
      if (subscriptions.data.length > 0) {
        this.logger.debug(`Found existing ${status} subscription`);
        return true;
      }
    }
    this.logger.debug('No existing subscriptions found');
    return false;
  } catch (error) {
    this.logger.error('Error checking existing subscriptions:', {
      error: error.message,
      customerId,
    });
    throw error;
  }
}

private async createBillingPortalSession(
  customerId: string
): Promise<Stripe.Response<Stripe.BillingPortal.Session>> {
  try {
    this.logger.debug(`Creating billing portal session for customer: ${customerId}`);
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.configService.get('FRONTEND_URL')}`,
    });
    this.logger.debug('Successfully created billing portal session', {
      sessionId: session.id,
    });
    return session;
  } catch (error) {
    this.logger.error('Error creating billing portal session:', {
      error: error.message,
      customerId,
    });
    throw error;
  }
}

  async handleWebhook(request: Request, response: Response) {
    try {
      this.logger.debug('Received Stripe webhook');
      const sig = request.headers['stripe-signature'];
      const endpointSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');

      if (!sig || !endpointSecret) {
        throw new Error('Missing stripe signature or endpoint secret');
      }

      let event: Stripe.Event;

      try {
        event = this.stripe.webhooks.constructEvent(
          request.body,
          sig,
          endpointSecret,
        );
        this.logger.debug(`Verified webhook signature for event: ${event.type}`);
      } catch (err: any) {
        this.logger.error(`Webhook signature verification failed: ${err.message}`);
        response.status(400).send(`Webhook Error: ${err.message}`);
        return;
      }

      try {
        switch (event.type) {
          case 'checkout.session.completed':
            await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
            break;

          case 'customer.subscription.deleted':
            await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
            break;

          case 'customer.subscription.updated':
            await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
            break;

          case 'invoice.payment_failed':
            await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
            break;

          case 'invoice.paid':
            await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
            break;
        }

        response.status(200).end();
      } catch (err) {
        this.logger.error('Error processing webhook:', {
          error: err,
          eventType: event.type,
        });
        
        response.status(200).end();
      }
    } catch (error) {
      this.logger.error('Error in handleWebhook:', {
        error: error.message,
        stack: error.stack,
      });
      response.status(500).send('Internal server error');
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    try {
      this.logger.debug('Processing checkout.session.completed webhook', {
        sessionId: session.id,
        mode: session.mode,
        subscriptionId: session.subscription,
      });
      
      if (session.mode === 'subscription' && session.subscription) {
        const subscription = await this.stripe.subscriptions.retrieve(session.subscription as string);
        this.logger.debug('Retrieved subscription details:', {
          subscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
        });

        const metadata = session.metadata;
        this.logger.debug('Session metadata:', metadata);

        if (!metadata?.attorneyId || !metadata?.subscriptionData) {
          throw new Error('Missing required metadata');
        }

        const subscriptionData = JSON.parse(metadata.subscriptionData);
        this.logger.debug('Parsed subscription data:', subscriptionData);

        await this.createSubscriptionSchedule(
          subscription,
          subscriptionData.originalBasePrice,
          subscriptionData.discountTier
        );

        await this.createInitialSubscriptionRecord(subscription, metadata);
        this.logger.debug('Successfully processed checkout completion');
      } else {
        this.logger.debug('Skipping non-subscription checkout session');
      }
    } catch (error) {
      this.logger.error('Error in handleCheckoutCompleted:', {
        error: error.message,
        stack: error.stack,
        sessionId: session.id,
        subscriptionId: session.subscription,
      });
      throw error;
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    try {
      this.logger.debug(`Processing subscription deletion: ${subscription.id}`);
      const supabase = this.supabaseService.getClient();
      
      const { error } = await supabase
        .from('attorney_subscriptions')
        .update({ subscriptionStatus: 'cancelled' })
        .eq('stripesubscriptionid', subscription.id);

      if (error) {
        throw error;
      }
        
      this.logger.debug('Successfully marked subscription as cancelled');
    } catch (error) {
      this.logger.error('Error handling subscription deletion:', {
        error: error.message,
        subscriptionId: subscription.id,
      });
      throw error;
    }
  }
  private async handleSubscriptionPhaseTransition(subscription: Stripe.Subscription): Promise<void> {
    try {
        this.logger.debug('Starting phase transition:', {
            subscriptionId: subscription.id,
            metadata: subscription.metadata
        });

        if (!subscription.metadata?.scheduled_phases || !subscription.metadata?.current_phase) {
            return;
        }

        const phases = JSON.parse(subscription.metadata.scheduled_phases);
        const currentPhaseIndex = parseInt(subscription.metadata.current_phase);
        const nextPhaseIndex = currentPhaseIndex + 1;

        if (nextPhaseIndex >= phases.length) {
            return;
        }

        const supabase = this.supabaseService.getClient();
        const { data: currentSubscriptionData } = await supabase
            .from('attorney_subscriptions')
            .select('remainingDiscountMonths, discountPercent')
            .eq('stripesubscriptionid', subscription.id)
            .single();

        const nextPhase = phases[nextPhaseIndex];
        const existingItemId = subscription.items.data[0].id;

        // Update subscription with next phase
        await this.stripe.subscriptions.update(subscription.id, {
            items: [{
                id: existingItemId,
                price: nextPhase.price,
            }],
            proration_behavior: 'none',
            metadata: {
                scheduled_phases: JSON.stringify(phases.slice(nextPhaseIndex + 1)),
                current_phase: nextPhaseIndex.toString(),
                current_iterations: '0'  // Reset iterations for new phase
            }
        });

        // Get prices for database update
        const nextPhasePrice = await this.getPriceAmount(nextPhase.price);
        const futurePhasePrice = phases[nextPhaseIndex + 1]?.price ? 
            await this.getPriceAmount(phases[nextPhaseIndex + 1].price) : 
            nextPhasePrice;

        const { error } = await supabase
            .from('attorney_subscriptions')
            .update({
                subscriptionStatus: subscription.status,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                currentPrice: nextPhasePrice,
                nextPrice: futurePhasePrice,
                remainingDiscountMonths: Math.max(0, (currentSubscriptionData?.remainingDiscountMonths || 0) - 1),
                discountPercent: currentPhaseIndex === 0 ? currentSubscriptionData?.discountPercent : 0
            })
            .eq('stripesubscriptionid', subscription.id);

        if (error) {
            throw error;
        }

        this.logger.debug('Successfully completed phase transition', {
            newPhase: nextPhaseIndex,
            newPrice: nextPhasePrice
        });
    } catch (error) {
        this.logger.error('Error in phase transition:', {
            error: error.message,
            subscriptionId: subscription.id
        });
        throw error;
    }
}
private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  try {
      this.logger.debug(`Processing subscription update: ${subscription.id}`, {
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
          metadata: subscription.metadata
      });

      const supabase = this.supabaseService.getClient();
      const { data: subscriptionData } = await supabase
          .from('attorney_subscriptions')
          .select('remainingDiscountMonths, currentPeriodEnd, discountPercent, subscriptionStatus')
          .eq('stripesubscriptionid', subscription.id)
          .single();

      // Check if we need to process phases
      if (!subscription.metadata?.scheduled_phases || !subscription.metadata?.current_phase) {
          return this.updateSubscriptionStatus(subscription);
      }

      // Check if this is a new billing period
      const lastPeriodEnd = subscriptionData?.currentPeriodEnd ? 
          new Date(subscriptionData.currentPeriodEnd).getTime() : 0;
      const newPeriodEnd = new Date(subscription.current_period_end * 1000).getTime();

      if (lastPeriodEnd === newPeriodEnd) {
          this.logger.debug('Not a new billing period, skipping iteration update');
          return;
      }

      const phases = JSON.parse(subscription.metadata.scheduled_phases);
      const currentPhaseIndex = parseInt(subscription.metadata.current_phase);
      const currentIterations = parseInt(subscription.metadata.current_iterations || '0');
      const currentPhase = phases[currentPhaseIndex];

 
      if (currentPhase?.iterations && subscription.status === 'active') {
          const newIterations = currentIterations + 1;
          this.logger.debug('Incrementing iterations', {
              oldValue: currentIterations,
              newValue: newIterations,
              required: currentPhase.iterations,
              status: subscription.status
          });

          if (newIterations >= currentPhase.iterations) {
              this.logger.debug('Required iterations reached, transitioning phase');
              return this.handleSubscriptionPhaseTransition(subscription);
          }

          // Update iteration count
          await this.stripe.subscriptions.update(subscription.id, {
              metadata: {
                  ...subscription.metadata,
                  current_iterations: newIterations.toString()
              }
          });

      
          if (subscriptionData?.remainingDiscountMonths > 0) {
              const newRemainingMonths = subscriptionData.remainingDiscountMonths - 1;
              
              const { error } = await supabase
                  .from('attorney_subscriptions')
                  .update({
                      remainingDiscountMonths: newRemainingMonths,
                      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                      discountPercent: newRemainingMonths > 0 ? subscriptionData.discountPercent : 0
                  })
                  .eq('stripesubscriptionid', subscription.id);

              if (error) {
                  throw error;
              }

              this.logger.debug('Updated remaining discount months', {
                  oldValue: subscriptionData.remainingDiscountMonths,
                  newValue: newRemainingMonths,
                  status: subscription.status
              });
          }
      } else {
          // Just update the status if we're still in trial
          await this.updateSubscriptionStatus(subscription);
      }
  } catch (error) {
      this.logger.error('Error handling subscription update:', {
          error: error.message,
          subscriptionId: subscription.id,
      });
      throw error;
  }
}

private async updateSubscriptionStatus(subscription: Stripe.Subscription): Promise<void> {
    try {
        const supabase = this.supabaseService.getClient();
        
        const { error } = await supabase
            .from('attorney_subscriptions')
            .update({
                subscriptionStatus: subscription.status,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000)
            })
            .eq('stripesubscriptionid', subscription.id);

        if (error) {
            throw error;
        }

        this.logger.debug('Successfully updated subscription status', {
            subscriptionId: subscription.id,
            status: subscription.status
        });
    } catch (error) {
        this.logger.error('Error updating subscription status:', {
            error: error.message,
            subscriptionId: subscription.id
        });
        throw error;
    }
}
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    try {
      this.logger.warn(`Payment failed for invoice: ${invoice.id}`, {
        customerId: invoice.customer,
        amount: invoice.amount_due,
        status: invoice.status,
      });

      if (invoice.subscription) {
        const supabase = this.supabaseService.getClient();

        const { error } = await supabase
          .from('attorney_subscriptions')
          .update({
            lastPaymentStatus: 'failed',
            lastPaymentDate: new Date(),
            lastPaymentAmount: invoice.amount_due,
          })
          .eq('stripesubscriptionid', invoice.subscription);

        if (error) {
          throw error;
        }

        this.logger.debug('Successfully updated payment failure information');
      }
    } catch (error) {
      this.logger.error('Error handling payment failure:', {
        error: error.message,
        invoiceId: invoice.id,
      });
      throw error;
    }
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    try {
      this.logger.debug(`Processing paid invoice: ${invoice.id}`, {
        customerId: invoice.customer,
        amount: invoice.amount_paid,
        status: invoice.status,
      });

      if (invoice.subscription) {
        const subscription = await this.stripe.subscriptions.retrieve(invoice.subscription as string);
        const supabase = this.supabaseService.getClient();

        const { error } = await supabase
          .from('attorney_subscriptions')
          .update({
            lastPaymentStatus: 'succeeded',
            lastPaymentDate: new Date(),
            lastPaymentAmount: invoice.amount_paid,
          })
          .eq('stripesubscriptionid', subscription.id);

        if (error) {
          throw error;
        }

        this.logger.debug('Successfully updated payment information');
      }
    } catch (error) {
      this.logger.error('Error handling paid invoice:', {
        error: error.message,
        invoiceId: invoice.id,
      });
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<object> {
    try {
      this.logger.debug(`Retrieving session: ${sessionId}`);
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      
      if (!session.subscription) {
        throw new Error('No subscription found for session');
      }

      const subscription = await this.stripe.subscriptions.retrieve(
        session.subscription as string,
      );
      
      this.logger.debug('Successfully retrieved session and subscription details');
      return { session, subscription };
    } catch (error) {
      this.logger.error('Error retrieving session:', {
        error: error.message,
        sessionId,
      });
      throw error;
    }
  }
}