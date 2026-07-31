'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, ShoppingBag, Calendar, Users, Package,
  TrendingUp, CheckCircle2, Clock, Truck, ShieldAlert,
  Plus, Edit, Trash2, ArrowLeft, LogOut, Search, Filter, Sparkles
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, DBOrder, DBArtistBooking, DBSupplierApplication, DBAcademyEnrollment } from '@/lib/supabase';

// Mock datasets for Admin view when live Supabase DB table is empty
const INITIAL_ORDERS: DBOrder[] = [
  {
    id: 'ord-101',
    customer_name: 'Harish Chandra',
    customer_phone: '+91 94140 11223',
    total_amount: 5499,
    shipping_address: '14, Civil Lines, Jaipur, Rajasthan',
    status: 'confirmed',
    created_at: '2026-07-30',
  },
  {
    id: 'ord-102',
    customer_name: 'Devendra Rathore',
    customer_phone: '+91 98280 44556',
    total_amount: 3299,
    shipping_address: 'Flat 402, Royal Residency, Delhi',
    status: 'shipped',
    created_at: '2026-07-29',
  },
];

const INITIAL_BOOKINGS: DBArtistBooking[] = [
  {
    id: 'b-01',
    customer_name: 'Rajesh Sharma',
    customer_phone: '+91 98290 12345',
    city_venue: 'Rambagh Palace, Jaipur',
    event_date: '2026-08-15',
    safa_style: 'Jodhpuri',
    artist_name: 'Master Ramesh',
    amount: 50,
    status: 'assigned',
  },
  {
    id: 'b-04',
    customer_name: 'Gaurav Khandelwal',
    customer_phone: '+91 99887 66554',
    city_venue: 'Fairmont Hotel, Jaipur',
    event_date: '2026-08-25',
    safa_style: 'Rounded',
    artist_name: 'Unassigned',
    amount: 50,
    status: 'pending',
  },
];

const INITIAL_SUPPLIERS: DBSupplierApplication[] = [
  {
    id: 'sup-01',
    business_name: 'Royal Rajasthan Silks',
    contact_name: 'Mahesh Sharma',
    phone: '+91 94140 88776',
    city: 'Jaipur',
    status: 'pending',
  },
];

export default function AdminPanelPage() {
  const { profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'bookings' | 'products' | 'suppliers'>('orders');

  const [orders, setOrders] = useState<DBOrder[]>(INITIAL_ORDERS);
  const [bookings, setBookings] = useState<DBArtistBooking[]>(INITIAL_BOOKINGS);
  const [suppliers, setSuppliers] = useState<DBSupplierApplication[]>(INITIAL_SUPPLIERS);

  const [assigningArtist, setAssigningArtist] = useState<string | null>(null);
  const [artistNameInput, setArtistNameInput] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const { data: orderRes } = await supabase.from('orders').select('*');
      if (orderRes && orderRes.length > 0) setOrders(orderRes);

      const { data: bookingRes } = await supabase.from('artist_bookings').select('*');
      if (bookingRes && bookingRes.length > 0) setBookings(bookingRes);

      const { data: supRes } = await supabase.from('supplier_applications').select('*');
      if (supRes && supRes.length > 0) setSuppliers(supRes);
    } catch (e) {
      console.warn('Admin fetch warning:', e);
    }
  };

  const updateOrderStatus = async (id: string, newStatus: DBOrder['status']) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
    );
    try {
      await supabase.from('orders').update({ status: newStatus }).eq('id', id);
    } catch (err) {
      console.warn('Status update warning:', err);
    }
  };

  const handleAssignArtist = async (bookingId: string) => {
    if (!artistNameInput) return;
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId ? { ...b, artist_name: artistNameInput, status: 'assigned' } : b
      )
    );
    try {
      await supabase
        .from('artist_bookings')
        .update({ artist_name: artistNameInput, status: 'assigned' })
        .eq('id', bookingId);
    } catch (err) {
      console.warn('Assign error:', err);
    }
    setAssigningArtist(null);
    setArtistNameInput('');
  };

  const totalRevenue = orders.reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-maroon-950 text-white shadow-lg border-b border-royal-400/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4">
              <Link href="/" className="w-10 h-10 rounded-full bg-royal-gradient flex items-center justify-center shadow-md">
                <Crown size={20} className="text-maroon-950" />
              </Link>
              <div>
                <h1 className="font-display font-black text-xl text-royal-100 uppercase tracking-widest leading-none">
                  SafaKing Admin Control
                </h1>
                <p className="text-[10px] text-royal-200/60 uppercase tracking-widest mt-1">
                  Master Operations & Logistics
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="hidden sm:flex items-center gap-1.5 text-xs text-royal-200/70 hover:text-royal-300 font-bold uppercase tracking-wider"
              >
                <ArrowLeft size={14} /> Back to Main Site
              </Link>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-royal-100 font-bold uppercase tracking-wider transition-colors"
              >
                <LogOut size={14} /> Exit Admin
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Executive Metrics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="p-6 rounded-3xl bg-white border border-amber-200/60 shadow-sm flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-royal-100 text-royal-800 flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-royal-800/60 uppercase tracking-widest">Total Sales Revenue</p>
              <p className="text-2xl font-display font-black text-maroon-950 mt-0.5">
                ₹{totalRevenue.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-amber-200/60 shadow-sm flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <ShoppingBag size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-amber-800/60 uppercase tracking-widest">Active Orders</p>
              <p className="text-2xl font-display font-black text-maroon-950 mt-0.5">
                {orders.length}
              </p>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-amber-200/60 shadow-sm flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest">Artist Bookings</p>
              <p className="text-2xl font-display font-black text-maroon-950 mt-0.5">
                {bookings.length}
              </p>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-amber-200/60 shadow-sm flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center">
              <Package size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-800/60 uppercase tracking-widest">Suppliers Pending</p>
              <p className="text-2xl font-display font-black text-maroon-950 mt-0.5">
                {suppliers.length}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-amber-200/70 mb-8 overflow-x-auto gap-2">
          {[
            { id: 'orders', label: 'Product Orders', icon: ShoppingBag },
            { id: 'bookings', label: 'Artist Bookings', icon: Calendar },
            { id: 'suppliers', label: 'Supplier Applications', icon: Package },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-3.5 text-xs font-bold uppercase tracking-widest border-b-2 transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'border-maroon-950 text-maroon-950 bg-white rounded-t-2xl shadow-sm'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: PRODUCT ORDERS */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-amber-100 flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-maroon-950">Fulfillment & Orders List</h3>
              <span className="text-xs text-gray-400 font-medium">Real-time status updater</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-amber-50/50 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-amber-100">
                  <tr>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">Shipping Address</th>
                    <th className="p-4">Total</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 text-xs">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="p-4 font-bold text-maroon-950">{order.customer_name}</td>
                      <td className="p-4 text-gray-600">{order.customer_phone}</td>
                      <td className="p-4 text-gray-600 max-w-xs">{order.shipping_address}</td>
                      <td className="p-4 font-black text-gradient-gold">₹{order.total_amount.toLocaleString()}</td>
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            order.status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.status === 'shipped'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <select
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value as any)}
                          className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white font-bold text-[11px] focus:ring-2 focus:ring-maroon-950/20"
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: ARTIST BOOKINGS */}
        {activeTab === 'bookings' && (
          <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-amber-100 flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-maroon-950">Artist Booking Dispatch</h3>
              <span className="text-xs text-gray-400 font-medium">Assign Safa Artists to Weddings</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-amber-50/50 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-amber-100">
                  <tr>
                    <th className="p-4">Client</th>
                    <th className="p-4">Event Date</th>
                    <th className="p-4">City / Venue</th>
                    <th className="p-4">Safa Style</th>
                    <th className="p-4">Assigned Artist</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 text-xs">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="p-4 font-bold text-maroon-950">
                        {booking.customer_name}
                        <br />
                        <span className="text-[10px] text-gray-400 font-normal">{booking.customer_phone}</span>
                      </td>
                      <td className="p-4 text-gray-700 font-medium">{booking.event_date}</td>
                      <td className="p-4 text-gray-700">{booking.city_venue}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-royal-100 text-royal-800 text-[10px] font-bold rounded-full uppercase">
                          {booking.safa_style}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-maroon-900">
                        {booking.artist_name || 'Unassigned'}
                      </td>
                      <td className="p-4">
                        {assigningArtist === booking.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Artist Name"
                              value={artistNameInput}
                              onChange={(e) => setArtistNameInput(e.target.value)}
                              className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg w-28"
                            />
                            <button
                              onClick={() => handleAssignArtist(booking.id)}
                              className="px-3 py-1 bg-maroon-950 text-white rounded-lg text-[10px] font-bold uppercase"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAssigningArtist(booking.id)}
                            className="px-3 py-1.5 bg-royal-100 hover:bg-royal-200 text-royal-900 font-bold rounded-xl text-[10px] uppercase tracking-wider"
                          >
                            Assign Artist
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SUPPLIER APPLICATIONS */}
        {activeTab === 'suppliers' && (
          <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-amber-100">
              <h3 className="font-display font-bold text-lg text-maroon-950">Supplier Network Submissions</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-amber-50/50 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-amber-100">
                  <tr>
                    <th className="p-4">Business Name</th>
                    <th className="p-4">Contact Person</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">City</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 text-xs">
                  {suppliers.map((sup) => (
                    <tr key={sup.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="p-4 font-bold text-maroon-950">{sup.business_name}</td>
                      <td className="p-4 text-gray-700">{sup.contact_name}</td>
                      <td className="p-4 text-gray-700">{sup.phone}</td>
                      <td className="p-4 text-gray-700">{sup.city}</td>
                      <td className="p-4">
                        <span className="px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full uppercase">
                          {sup.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
