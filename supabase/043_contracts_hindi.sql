-- ============================================================================
-- 043 — The terms in Hindi as well as English
--
-- Run in the Supabase SQL Editor. Safe to run again.
--
-- "टर्म एक्सेप्ट करने वाला हिंदी और अंग्रेजी दोनो का टिक करने का कर देना ताकि
--  हिंदी में भी पढ़ा जा सके" — the tick-box on every booking form now offers
-- the terms in Hindi. The sentence beside the tick is in both languages in the
-- app itself; the terms themselves come from here.
--
-- Each active contract gets a Hindi translation of exactly the English text it
-- holds today. The translation is only written where none exists, so an edit
-- made later in the SQL editor is never overwritten by re-running this file.
--
-- If you change an English body later, write the matching Hindi into body_hi
-- in the same statement. A row with no body_hi simply shows English only —
-- never a translation of terms that have since changed.
-- ============================================================================

alter table public.contracts add column if not exists title_hi text;
alter table public.contracts add column if not exists body_hi  text;

comment on column public.contracts.title_hi is 'Hindi heading. Null means the tick-box shows English only.';
comment on column public.contracts.body_hi  is 'Hindi translation of body, for the same version. Null means English only.';

-- ---------------------------------------------------------------------------
-- Customer booking terms — the artist booking form and /rent
-- ---------------------------------------------------------------------------
update public.contracts set
  title_hi = 'बुकिंग की शर्तें',
  body_hi  = $hi$मैं समझता/समझती हूँ कि: अगर तय किया गया साफा आर्टिस्ट वेन्यू आते समय किसी सच्ची मेडिकल इमरजेंसी के कारण देर हो जाए, तो मैं SafaKing की सपोर्ट टीम के साथ सहयोग करूँगा/करूँगी — ऐसी हालत में दूसरा आर्टिस्ट भेजने या पहुँचने का नया समय तय करने में कुछ अतिरिक्त समय लग सकता है। एडवांस के बाद बाकी भुगतान कार्यक्रम की तारीख से कम से कम एक दिन पहले पूरा करना होगा — बाकी रकम मिलने के बाद ही आर्टिस्ट भेजा जाता है। मुझे आर्टिस्ट को सीधे भुगतान नहीं करना है — सारा भुगतान SafaKing के ज़रिए होता है। बुकिंग के समय मुझे कार्यक्रम का सही पता और पिनकोड देना होगा।$hi$
where audience = 'customer' and active and coalesce(body_hi, '') = '';

-- ---------------------------------------------------------------------------
-- Groom safa purchase terms — the shop cart
-- ---------------------------------------------------------------------------
update public.contracts set
  title_hi = 'दूल्हा साफा खरीद की शर्तें',
  body_hi  = $hi$मैं समझता/समझती हूँ कि: बाँधे हुए या इस्तेमाल किए हुए साफे SafaKing वापस नहीं लेता — अगर साफा बिना इस्तेमाल, दोबारा बेचने लायक हालत में वापस आता है तो डाक/हैंडलिंग चार्ज लगेगा और वह मेरे एडवांस में से काटा जाएगा; फटा, कटा या इस्तेमाल किया हुआ साफा वापस करने पर एडवांस का कोई रिफंड नहीं मिलेगा; बुकिंग के समय मुझे सही नाप और पिनकोड सहित पूरा डाक पता देना होगा।$hi$
where audience = 'groom_safa' and active and coalesce(body_hi, '') = '';

-- ---------------------------------------------------------------------------
-- Artist service agreement — the artist application form
-- ---------------------------------------------------------------------------
update public.contracts set
  title_hi = 'साफा आर्टिस्ट सेवा अनुबंध',
  body_hi  = $hi$बुकिंग स्वीकार करने पर मैं सहमत हूँ कि: मैं वेन्यू पर समय पर पहुँचूँगा; वेन्यू जाते समय हेलमेट पहनूँगा; यात्रा के लिए वैध निजी बीमा रखूँगा; ग्राहक से सीधे कोई भुगतान नहीं लूँगा — सारा भुगतान SafaKing के ज़रिए होता है; SafaKing के ज़रिए मिले ग्राहक से सीधे कोई बुकिंग नहीं लूँगा, और ऐसे ग्राहक को आगे किसी भी कार्यक्रम के लिए मुझे सीधे बुक करने के लिए नहीं कहूँगा — उनके साथ हर बुकिंग और भुगतान SafaKing के ज़रिए ही होगा, और SafaKing के ग्राहक को प्लेटफ़ॉर्म से बाहर ले जाने की कोशिश प्लेटफ़ॉर्म नीति का उल्लंघन है; बुकिंग स्वीकार करने के बाद अगर मैं नहीं पहुँच सकता, तो SafaKing के ज़रिए दूसरा आर्टिस्ट भेजने की व्यवस्था करूँगा ताकि ऑर्डर पूरा हो — स्वीकार करने के बाद ऑर्डर ऐसे ही रद्द नहीं किया जा सकता; और मैं पूरे समय पेशेवर व्यवहार रखूँगा। मैं समझता हूँ कि शादी से 3 दिन के भीतर बिना वाजिब कारण स्वीकार की गई तारीख बदलने से मेरी रेटिंग पर असर पड़ता है।$hi$
where audience = 'artist' and active and coalesce(body_hi, '') = '';

-- What the tick-box will show:
select audience, version, title, title_hi,
       length(body) as english_letters, length(body_hi) as hindi_letters
  from public.contracts
 where active
 order by audience;
