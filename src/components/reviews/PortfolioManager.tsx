'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Images, Video, Trash2, Loader2, AlertCircle, Plus, EyeOff } from 'lucide-react';
import {
  PortfolioItem, listPortfolio, addPortfolioPhoto, addPortfolioVideo,
  removePortfolioItem, portfolioUrl,
} from '@/lib/reviews';

/** An artist's own portfolio: photos, video links and past events. */
export function PortfolioManager({ artistId }: { artistId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [caption, setCaption] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listPortfolio(artistId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your portfolio.');
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  useEffect(() => {
    load();
  }, [load]);

  const clearFields = () => {
    setCaption('');
    setEventName('');
    setEventDate('');
    setVideoUrl('');
  };

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await addPortfolioPhoto({ artistId, file, caption, eventName, eventDate });
      clearFields();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleVideo = async () => {
    if (!videoUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addPortfolioVideo({ artistId, url: videoUrl, caption, eventName });
      clearFields();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that video.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (item: PortfolioItem) => {
    if (!confirm('Remove this from your portfolio?')) return;
    setBusy(true);
    try {
      await removePortfolioItem(item);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that item.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-amber-100">
        <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
          <Images size={18} className="text-amber-600" /> My Portfolio
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Customers look at your work before they book. {items.length} item
          {items.length === 1 ? '' : 's'} published.
        </p>
      </div>

      <div className="p-6 space-y-5">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
        )}

        {/* Add new */}
        <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/70 space-y-3">
          <p className="text-xs font-black uppercase tracking-wider text-maroon-900 flex items-center gap-1.5">
            <Plus size={13} /> Add to portfolio
          </p>

          <div className="grid sm:grid-cols-3 gap-2">
            <input
              placeholder="Event name (e.g. Sharma Wedding)"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-maroon-800/20 outline-none"
            />
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-maroon-800/20 outline-none"
            />
            <input
              placeholder="Caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-maroon-800/20 outline-none"
            />
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => handlePhoto(e.target.files?.[0])}
            className="block w-full text-[11px] text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[11px] file:font-bold file:bg-maroon-950 file:text-royal-300 hover:file:bg-maroon-900 file:cursor-pointer disabled:opacity-50"
          />

          <div className="flex gap-2">
            <input
              placeholder="…or paste a video link (YouTube, Instagram)"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-maroon-800/20 outline-none"
            />
            <button
              type="button"
              onClick={handleVideo}
              disabled={busy || !videoUrl.trim()}
              className="px-4 py-2 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-50 text-royal-300 text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5"
            >
              <Video size={13} /> Add
            </button>
          </div>

          {busy && (
            <p className="text-[11px] text-amber-700 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Working…
            </p>
          )}
        </div>

        {/* Existing */}
        {loading ? (
          <div className="py-8 text-center text-gray-500">
            <Loader2 size={20} className="animate-spin mx-auto mb-2 text-amber-500" />
            <p className="text-xs font-bold">Loading…</p>
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Nothing here yet. Add a few photos of safas you have tied.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((item) => {
              const url = portfolioUrl(item);
              return (
                <div
                  key={item.id}
                  className="relative group rounded-2xl overflow-hidden border border-amber-200/70 bg-gray-50"
                >
                  {item.media_kind === 'photo' && url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={item.caption ?? 'Portfolio item'} className="w-full h-32 object-cover" />
                  ) : (
                    <a
                      href={url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center h-32 text-maroon-900 hover:bg-amber-50"
                    >
                      <Video size={24} />
                      <span className="text-[10px] font-bold mt-1">Watch video</span>
                    </a>
                  )}

                  {!item.visible && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-900/80 text-white text-[9px] font-black uppercase">
                      <EyeOff size={9} /> Hidden
                    </span>
                  )}

                  <button
                    onClick={() => handleRemove(item)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 text-rose-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    aria-label="Remove"
                  >
                    <Trash2 size={13} />
                  </button>

                  {(item.event_name || item.caption) && (
                    <div className="p-2">
                      <p className="text-[11px] font-bold text-maroon-950 truncate">
                        {item.event_name || item.caption}
                      </p>
                      {item.event_date && (
                        <p className="text-[10px] text-gray-400">{item.event_date}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
