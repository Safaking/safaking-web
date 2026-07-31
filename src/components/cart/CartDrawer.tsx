'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ShoppingBag, Trash2, Plus, Minus, CheckCircle2, ArrowRight, AlertCircle, Loader2,
} from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';

export function CartDrawer() {
  const { profile, user } = useAuth();
  const { items, subtotal, isOpen, closeCart, removeItem, setQuantity, clear } = useCart();

  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderRef, setOrderRef] = useState<string | null>(null);

  // Prefill from the signed-in profile once it arrives.
  useEffect(() => {
    if (profile?.full_name) setName((prev) => prev || profile.full_name);
    if (profile?.phone) setPhone((prev) => prev || profile.phone!);
  }, [profile]);

  const total = subtotal; // Shipping is free pan-India.

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const orderPayload: any = {
      customer_id: user?.id ?? null,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      shipping_address: address.trim(),
      total_amount: total,
      status: 'confirmed',
    };
    if (user?.email) {
      orderPayload.customer_email = user.email;
    }

    let { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select('id')
      .single();

    // Auto fallback if customer_email column does not exist in Supabase table
    if (orderErr && (orderErr.message?.includes('customer_email') || orderErr.code === 'PGRST204')) {
      delete orderPayload.customer_email;
      const retry = await supabase
        .from('orders')
        .insert(orderPayload)
        .select('id')
        .single();
      order = retry.data;
      orderErr = retry.error;
    }

    if (orderErr || !order) {
      setSubmitting(false);
      setError(friendlyError(orderErr));
      return;
    }

    const { error: itemsErr } = await supabase.from('order_items').insert(
      items.map((item) => ({
        order_id: order.id,
        product_id: item.productId ?? null,
        product_name: item.name,
        price: item.price,
        quantity: item.quantity,
      }))
    );

    setSubmitting(false);

    if (itemsErr) {
      setError(
        `Order ${order.id.slice(0, 8)} was created but its items failed to save: ${friendlyError(itemsErr)}`
      );
      return;
    }

    setOrderRef(order.id);
    setStep('success');
    clear();
  };

  const handleClose = () => {
    closeCart();
    // Reset back to the bag view once the success panel has been dismissed.
    if (step === 'success') {
      setStep('cart');
      setOrderRef(null);
      setAddress('');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-maroon-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
        >
          {/* Drawer Header */}
          <div className="p-6 bg-maroon-950 text-white flex items-center justify-between border-b border-royal-400/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-royal-gradient flex items-center justify-center">
                <ShoppingBag size={18} className="text-maroon-950" />
              </div>
              <div>
                <h3 className="font-display font-black text-lg text-royal-100 uppercase tracking-widest">
                  Royal Bag
                </h3>
                <p className="text-[10px] text-royal-200/50 uppercase tracking-wider">
                  {items.length} {items.length === 1 ? 'item' : 'items'} selected
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            {step === 'success' ? (
              <div className="py-16 text-center space-y-4">
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5 }}>
                  <CheckCircle2 size={64} className="text-emerald-500 mx-auto" />
                </motion.div>
                <h4 className="font-display font-black text-2xl text-maroon-900">
                  Order Placed Successfully!
                </h4>
                {orderRef && (
                  <p className="text-xs font-bold text-maroon-800 tracking-wider">
                    Order reference:{' '}
                    <span className="text-gradient-gold">{orderRef.slice(0, 8).toUpperCase()}</span>
                  </p>
                )}
                <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                  Thank you for shopping with SafaKing. Our dispatch team will contact you for
                  delivery tracking.
                </p>
                <button
                  onClick={handleClose}
                  className="mt-2 px-6 py-3 bg-maroon-950 hover:bg-maroon-900 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest transition-colors"
                >
                  Continue Shopping
                </button>
              </div>
            ) : step === 'checkout' ? (
              <form onSubmit={handleCheckout} className="space-y-4">
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed">{error}</p>
                  </div>
                )}

                <div className="bg-royal-50 p-4 rounded-2xl border border-royal-200">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-maroon-900 mb-2">
                    Order Summary
                  </h4>
                  <div className="flex justify-between text-xs font-bold text-maroon-950">
                    <span>Total ({items.length} items)</span>
                    <span className="text-gradient-gold text-base">₹{total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Full Name
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Vikram Singh"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-maroon-800/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Phone Number
                    </label>
                    <input
                      required
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-maroon-800/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Shipping Address
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Full delivery address with Pincode"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-maroon-800/20 outline-none resize-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || items.length === 0}
                  className="w-full py-4 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 disabled:cursor-not-allowed text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all mt-4"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Confirming Order…
                    </>
                  ) : (
                    <>
                      Confirm Order (Pay on Delivery)
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="w-full py-2 text-xs text-gray-400 font-bold uppercase tracking-wider hover:text-gray-600"
                >
                  ← Back to Bag
                </button>
              </form>
            ) : items.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <ShoppingBag size={48} className="text-gray-300 mx-auto stroke-1" />
                <p className="font-display font-bold text-lg text-maroon-900">Your Bag is Empty</p>
                <p className="text-xs text-gray-400">Explore our royal safas and add your favorites.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 p-3 bg-gray-50 rounded-2xl border border-gray-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                    <div className="flex-1 flex flex-col justify-center gap-1.5">
                      <h4 className="font-bold text-sm text-maroon-950 leading-snug">{item.name}</h4>
                      <p className="text-xs text-gradient-gold font-black">
                        ₹{(item.price * item.quantity).toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQuantity(item.id, item.quantity - 1)}
                          className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center text-maroon-900 hover:bg-white transition-colors"
                          aria-label={`Decrease quantity of ${item.name}`}
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(item.id, item.quantity + 1)}
                          className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center text-maroon-900 hover:bg-white transition-colors"
                          aria-label={`Increase quantity of ${item.name}`}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-gray-400 hover:text-rose-600 transition-colors p-2 self-start"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          {items.length > 0 && step === 'cart' && (
            <div className="p-6 bg-gray-50 border-t border-gray-200 space-y-4">
              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-maroon-950">₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping (Pan-India)</span>
                  <span className="font-bold text-emerald-600">FREE</span>
                </div>
                <div className="flex justify-between text-base font-black text-maroon-950 pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span className="text-gradient-gold">₹{total.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => setStep('checkout')}
                className="w-full py-4 bg-maroon-950 hover:bg-maroon-900 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-colors"
              >
                Proceed to Checkout
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
