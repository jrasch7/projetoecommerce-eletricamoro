import { prisma } from "../lib/prisma.js";
import axios from "axios";

export interface PaymentProvider {
  name: string;
  processPayment(orderData: any): Promise<any>;
  handleWebhook(webhookData: any): Promise<any>;
}

export class WhatsAppPaymentProvider implements PaymentProvider {
  name = "WhatsApp";

  async processPayment(orderData: any) {
    // Generate WhatsApp message for order
    const message = this.formatWhatsAppMessage(orderData);
    return { provider: "WhatsApp", message, status: "pending" };
  }

  async handleWebhook(_webhookData: any) {
    // WhatsApp doesn't use webhooks in this context
    return { status: "not_applicable" };
  }

  private formatWhatsAppMessage(orderData: any): string {
    const items = orderData.items?.map((item: any) => 
      `${item.name} - R$ ${item.price} x ${item.quantity}`
    ).join("\n") || "";

    return `🛒 *Novo Pedido*

*Cliente:* ${orderData.customer}
*Total:* R$ ${orderData.total.toFixed(2)}

*Itens:*
${items}

*Endereço:* ${orderData.address || "Não informado"}`;
  }
}

export class PagBankPaymentProvider implements PaymentProvider {
  name = "PagBank";

  async processPayment(orderData: any) {
    try {
      // Get PagBank configuration
      const config = await prisma.paymentConfig.findFirst();
      if (!config || !config.apiKey || !config.merchantId) {
        throw new Error("PagBank configuration incomplete");
      }

      // PagBank Sandbox URL (change to production URL when ready)
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://api.pagbank.com.br' 
        : 'https://sandbox.api.pagseguro.uol.com.br';

      // Prepare payment request for Checkout Transparente
      const paymentRequest = {
        merchantOrderId: orderData.orderId || `ORDER-${Date.now()}`,
        customer: {
          name: orderData.customerName,
          email: orderData.customerEmail,
          taxId: orderData.customerTaxId || null,
          phone: {
            country: '55',
            area: orderData.customerPhone?.substring(2, 4) || '11',
            number: orderData.customerPhone?.substring(5) || '999999999',
            type: 'MOBILE'
          }
        },
        payment: {
          amount: {
            value: Math.round(orderData.total * 100), // Convert to cents
            currency: 'BRL'
          },
          paymentMethod: {
            type: 'CREDIT_CARD',
            installments: {
              quantity: 1,
              amount: Math.round(orderData.total * 100)
            },
            card: {
              number: orderData.cardNumber,
              expiry: orderData.cardExpiry,
              securityCode: orderData.cardCvv,
              holder: orderData.cardName
            }
          }
        }
      };

      // Make API call to PagBank
      const response = await axios.post(
        `${baseUrl}/checkout/v2/charges`,
        paymentRequest,
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey
          }
        }
      );

      if (response.data && response.data.charges && response.data.charges[0]) {
        const charge = response.data.charges[0];
        const status = charge.status;
        const transactionId = charge.id;

        // Update order with transaction ID
        if (orderData.orderId) {
          await prisma.order.update({
            where: { id: orderData.orderId },
            data: {
              transactionId: transactionId,
              paymentMethod: 'Cartão de Crédito - PagBank',
              status: status === 'APPROVED' ? 'Pago' : 'Pendente'
            }
          });
        }

        return {
          provider: "PagBank",
          status: status === 'APPROVED' ? 'approved' : 'pending',
          transactionId: transactionId,
          message: status === 'APPROVED' ? 'Pagamento aprovado' : 'Pagamento em processamento'
        };
      }

      throw new Error('Invalid response from PagBank');
    } catch (error: any) {
      console.error('PagBank payment error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Erro ao processar pagamento PagBank');
    }
  }

  async handleWebhook(webhookData: any) {
    try {
      // Validate webhook security
      const config = await prisma.paymentConfig.findFirst();
      if (!config || !config.apiSecret) {
        throw new Error("Webhook configuration incomplete");
      }

      // Validate webhook signature/token (basic security)
      const receivedToken = webhookData.headers?.['x-webhook-token'] || webhookData.token;
      if (receivedToken !== config.apiSecret) {
        throw new Error("Invalid webhook token");
      }

      // Parse webhook notification
      const notification = webhookData.body || webhookData;
      const transactionId = notification.charges?.[0]?.id;
      const status = notification.charges?.[0]?.status;
      const referenceId = notification.reference_id; // This should match our order ID

      if (!transactionId || !status) {
        throw new Error("Invalid webhook data");
      }

      // Find and update order
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { transactionId: transactionId },
            { id: referenceId }
          ]
        }
      });

      if (order) {
        const newStatus = status === 'APPROVED' ? 'Pago' : 
                         status === 'DECLINED' ? 'Cancelado' : 
                         status === 'IN_ANALYSIS' ? 'Em Análise' : 'Pendente';

        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: newStatus,
            transactionId: transactionId,
            updatedAt: new Date()
          }
        });

        return { success: true, orderId: order.id, status: newStatus };
      }

      return { success: false, message: "Order not found" };
    } catch (error: any) {
      console.error('PagBank webhook error:', error.message);
      throw error;
    }
  }
}

export class MercadoPagoPaymentProvider implements PaymentProvider {
  name = "MercadoPago";

  async processPayment(_orderData: any) {
    return {
      provider: "MercadoPago",
      status: "pending",
      message: "MercadoPago integration pending implementation"
    };
  }

  async handleWebhook(_webhookData: any) {
    return { status: "pending" };
  }
}

export class CieloPaymentProvider implements PaymentProvider {
  name = "Cielo";

  async processPayment(_orderData: any) {
    return {
      provider: "Cielo",
      status: "pending",
      message: "Cielo integration pending implementation"
    };
  }

  async handleWebhook(_webhookData: any) {
    return { status: "pending" };
  }
}

export class PaymentService {
  private providers: Map<string, PaymentProvider> = new Map();

  constructor() {
    this.providers.set("WhatsApp", new WhatsAppPaymentProvider());
    this.providers.set("PagBank", new PagBankPaymentProvider());
    this.providers.set("MercadoPago", new MercadoPagoPaymentProvider());
    this.providers.set("Cielo", new CieloPaymentProvider());
  }

  async getActiveProvider(): Promise<PaymentProvider | null> {
    const config = await prisma.paymentConfig.findFirst();
    if (!config) return null;

    const provider = this.providers.get(config.activeProvider);
    return provider || null;
  }

  async processPayment(orderData: any) {
    const config = await prisma.paymentConfig.findFirst();
    if (!config) throw new Error("No payment configuration found");

    const requestedMethod = String(orderData.paymentMethodType || "CARD").toUpperCase();
    const providersMap = (config.methodProviders ?? {}) as Record<string, string>;
    const resolvedProviderName = providersMap[requestedMethod] || config.activeProvider;
    const provider = this.providers.get(resolvedProviderName);
    if (!provider) throw new Error(`No provider configured for method ${requestedMethod}`);

    return provider.processPayment(orderData);
  }

  async handleWebhook(providerName: string, webhookData: any) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Unknown payment provider: ${providerName}`);
    }

    return provider.handleWebhook(webhookData);
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

export const paymentService = new PaymentService();
