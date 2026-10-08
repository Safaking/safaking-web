/**
 * The questions customers actually ask, in Hindi and English.
 *
 * One list, used twice: the /faq page renders it, and the page's structured
 * data hands the same questions to Google, which is what puts the answers
 * straight into a search result. Anything added here appears in both.
 *
 * Numbers are never typed in. A few answers carry a token — {advance},
 * {groomAdvance}, {dateChangeDays} — which the page fills from the same
 * settings that run a real booking, so the FAQ cannot promise one figure
 * while the checkout charges another. The fallbacks below are what a
 * crawler (and anyone with no connection) sees.
 */

export interface FaqAnswer {
  en: string;
  hi: string;
}

export interface FaqItem {
  id: string;
  q: FaqAnswer;
  a: FaqAnswer;
}

export interface FaqGroup {
  id: string;
  title: FaqAnswer;
  items: FaqItem[];
}

/** What a token stands for when the live settings have not loaded. */
export const FAQ_FALLBACKS: Record<string, string> = {
  advance: '50',
  groomAdvance: '25',
  dateChangeDays: '3',
};

export function fillTokens(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key) => values[key] ?? FAQ_FALLBACKS[key] ?? whole);
}

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: 'booking',
    title: { en: 'Booking a safa artist', hi: 'साफा आर्टिस्ट की बुकिंग' },
    items: [
      {
        id: 'how-to-book',
        q: { en: 'How do I book a safa artist?', hi: 'साफा आर्टिस्ट कैसे बुक करें?' },
        a: {
          en: 'Open the booking form on the home page, choose the safa style and your event date, tell us how many safas you need and where the event is, then pay the advance online. The booking is confirmed the moment the advance is received.',
          hi: 'होम पेज पर बुकिंग फ़ॉर्म खोलें, साफा स्टाइल और कार्यक्रम की तारीख चुनें, कितने साफे चाहिए और जगह कौन सी है यह बताएं, फिर ऑनलाइन एडवांस दें। एडवांस मिलते ही बुकिंग कन्फर्म हो जाती है।',
        },
      },
      {
        id: 'groom-or-baraat',
        q: { en: 'Does the artist tie the groom’s safa as well?', hi: 'क्या आर्टिस्ट दूल्हे का साफा भी बाँधता है?' },
        a: {
          en: 'At the moment our artists come for the baraat and tie the guests’ safas. The groom’s own safa and sehra are bought online from our shop, so they reach him ready and in his size.',
          hi: 'अभी हमारे आर्टिस्ट बारात के लिए आते हैं और मेहमानों के साफे बाँधते हैं। दूल्हे का अपना साफा और सेहरा हमारी शॉप से ऑनलाइन खरीदा जाता है, ताकि वह तैयार और सही नाप में उन तक पहुँचे।',
        },
      },
      {
        id: 'how-many',
        q: { en: 'How many safas can be tied at one event?', hi: 'एक कार्यक्रम में कितने साफे बाँधे जा सकते हैं?' },
        a: {
          en: 'Put the number into the booking form and we allocate enough artists for it. For a very large baraat, call us first so the team can be planned properly.',
          hi: 'बुकिंग फ़ॉर्म में संख्या भर दें, उसी हिसाब से आर्टिस्ट तय किए जाते हैं। बहुत बड़ी बारात के लिए पहले फ़ोन करें, ताकि टीम ठीक से तय की जा सके।',
        },
      },
      {
        id: 'where',
        q: { en: 'Which cities do you serve?', hi: 'आप किन शहरों में सेवा देते हैं?' },
        a: {
          en: 'Artist bookings are taken across India and given to the nearest available artist; the shop delivers all over India. If you are unsure about your venue, call us before booking.',
          hi: 'आर्टिस्ट बुकिंग पूरे भारत में ली जाती है और सबसे नज़दीकी उपलब्ध आर्टिस्ट को दी जाती है; शॉप की डिलीवरी पूरे भारत में होती है। अपनी जगह को लेकर संदेह हो तो बुकिंग से पहले फ़ोन करें।',
        },
      },
      {
        id: 'how-early',
        q: { en: 'How far in advance should I book?', hi: 'कितने पहले बुकिंग करनी चाहिए?' },
        a: {
          en: 'As early as you can during the wedding season — a date is held for you only once the advance is received, and good dates fill up.',
          hi: 'शादी के सीज़न में जितना जल्दी हो सके — तारीख आपके नाम तभी रुकती है जब एडवांस मिल जाए, और अच्छी तारीखें जल्दी भर जाती हैं।',
        },
      },
    ],
  },
  {
    id: 'groom-safa',
    title: { en: 'Groom safa and shop orders', hi: 'दूल्हा साफा और शॉप ऑर्डर' },
    items: [
      {
        id: 'buy-groom-safa',
        q: { en: 'Where do I buy the groom’s safa?', hi: 'दूल्हे का साफा कहाँ से खरीदें?' },
        a: {
          en: 'From the shop on this site. Choose the safa, pay the {groomAdvance}% advance, and it is delivered to your address — every groom deserves a royal crown of his own rather than a borrowed one.',
          hi: 'इसी साइट की शॉप से। साफा चुनें, {groomAdvance}% एडवांस दें, और वह आपके पते पर पहुँच जाता है — हर दूल्हे के पास अपना शाही ताज होना चाहिए, माँगा हुआ नहीं।',
        },
      },
      {
        id: 'returns',
        q: { en: 'Can I return a safa?', hi: 'क्या साफा वापस किया जा सकता है?' },
        a: {
          en: 'A tied or used safa cannot be returned. If a safa comes back unused and in resalable condition, a postal and handling charge applies and is deducted from your advance. A damaged, cut or used safa is not eligible for a refund.',
          hi: 'बाँधा हुआ या इस्तेमाल किया हुआ साफा वापस नहीं लिया जाता। अगर साफा बिना इस्तेमाल, दोबारा बेचने लायक हालत में वापस आता है तो डाक और हैंडलिंग चार्ज लगता है जो एडवांस में से काटा जाता है। फटा, कटा या इस्तेमाल किया हुआ साफा रिफंड के योग्य नहीं है।',
        },
      },
      {
        id: 'size',
        q: { en: 'How do I get the size right?', hi: 'सही नाप कैसे तय करें?' },
        a: {
          en: 'Give the head size when you order — the product page has a size guide showing how to measure. If you are unsure, call or WhatsApp us before paying.',
          hi: 'ऑर्डर करते समय सिर का नाप दें — प्रोडक्ट पेज पर नाप लेने का गाइड दिया गया है। संदेह हो तो भुगतान से पहले फ़ोन या WhatsApp करें।',
        },
      },
      {
        id: 'delivery',
        q: { en: 'How long does delivery take, and what does it cost?', hi: 'डिलीवरी में कितना समय लगता है और खर्च कितना है?' },
        a: {
          en: 'We deliver across India. The delivery charge and the expected date are both shown on your order before you pay — nothing is added afterwards.',
          hi: 'हम पूरे भारत में डिलीवरी करते हैं। डिलीवरी चार्ज और पहुँचने की संभावित तारीख, दोनों भुगतान से पहले आपके ऑर्डर में दिखते हैं — बाद में कुछ नहीं जोड़ा जाता।',
        },
      },
    ],
  },
  {
    id: 'rent',
    title: { en: 'Renting safas', hi: 'साफा किराये पर' },
    items: [
      {
        id: 'can-i-rent',
        q: { en: 'Can I rent safas instead of buying them?', hi: 'क्या साफे खरीदने के बजाय किराये पर लिए जा सकते हैं?' },
        a: {
          en: 'Yes. The Rent page prices safas per day for the dates you choose, and shows the rent, the artist charge if you want one, and the deposit before you pay.',
          hi: 'हाँ। Rent पेज आपकी चुनी तारीखों के लिए प्रति दिन किराया लगाता है, और भुगतान से पहले किराया, आर्टिस्ट का चार्ज (अगर चाहिए) और डिपॉज़िट दिखा देता है।',
        },
      },
      {
        id: 'deposit',
        q: { en: 'What is the refundable deposit?', hi: 'रिफंडेबल डिपॉज़िट क्या है?' },
        a: {
          en: 'An amount held against the safas while they are with you, and returned once they come back. It is shown separately from the rent on your booking.',
          hi: 'यह वह रकम है जो साफे आपके पास रहने तक जमा रहती है और वापस आने पर लौटा दी जाती है। आपकी बुकिंग में यह किराये से अलग दिखाई जाती है।',
        },
      },
    ],
  },
  {
    id: 'payment',
    title: { en: 'Payment, refunds and changes', hi: 'भुगतान, रिफंड और बदलाव' },
    items: [
      {
        id: 'advance',
        q: { en: 'How much do I pay to confirm a booking?', hi: 'बुकिंग कन्फर्म करने के लिए कितना देना होता है?' },
        a: {
          en: 'An artist booking takes a {advance}% advance and a groom safa takes {groomAdvance}%. The balance goes to SafaKing before the event date — the artist is sent out once it is received.',
          hi: 'आर्टिस्ट बुकिंग पर {advance}% एडवांस और दूल्हा साफे पर {groomAdvance}% लगता है। बाकी रकम कार्यक्रम की तारीख से पहले SafaKing को देनी होती है — वह मिलने पर ही आर्टिस्ट भेजा जाता है।',
        },
      },
      {
        id: 'pay-artist',
        q: { en: 'Should I pay the artist at the venue?', hi: 'क्या आर्टिस्ट को वेन्यू पर भुगतान करना है?' },
        a: {
          en: 'No — never pay the artist directly. Every payment goes through SafaKing, and SafaKing pays the artist. This protects both of you if anything goes wrong.',
          hi: 'नहीं — आर्टिस्ट को सीधे भुगतान कभी न करें। सारा भुगतान SafaKing के ज़रिए होता है और SafaKing आर्टिस्ट को देता है। कुछ गड़बड़ होने पर यही दोनों की सुरक्षा है।',
        },
      },
      {
        id: 'how-to-pay',
        q: { en: 'Which payment methods can I use?', hi: 'भुगतान किन तरीकों से किया जा सकता है?' },
        a: {
          en: 'UPI, cards and net banking, through our online payment gateway. You get a confirmation and an invoice for every payment.',
          hi: 'UPI, कार्ड और नेट बैंकिंग — हमारे ऑनलाइन पेमेंट गेटवे से। हर भुगतान की पुष्टि और इनवॉइस आपको मिलती है।',
        },
      },
      {
        id: 'cancel',
        q: { en: 'What happens if I cancel?', hi: 'बुकिंग रद्द करने पर क्या होता है?' },
        a: {
          en: 'How much comes back depends on how long before the event you cancel — the full table is on the Policies page, and the exact amount is worked out and shown to you before you confirm the cancellation. If we cannot serve a confirmed booking, you get 100% of the unserved amount back.',
          hi: 'कितना वापस मिलेगा यह इस पर निर्भर है कि आप कार्यक्रम से कितना पहले रद्द करते हैं — पूरी सूची Policies पेज पर है, और रद्द करने की पुष्टि से पहले सही रकम निकालकर आपको दिखा दी जाती है। अगर हम कन्फर्म बुकिंग पूरी नहीं कर पाते, तो बिना सेवा वाली पूरी रकम 100% वापस मिलती है।',
        },
      },
      {
        id: 'reschedule',
        q: { en: 'Can I change the date after booking?', hi: 'क्या बुकिंग के बाद तारीख बदली जा सकती है?' },
        a: {
          en: 'A date change is free if you ask at least {dateChangeDays} days before the event and an artist is free on the new date. Closer than that, or for a time change, call us and we will do what we can.',
          hi: 'अगर आप कार्यक्रम से कम से कम {dateChangeDays} दिन पहले कहते हैं और नई तारीख पर आर्टिस्ट उपलब्ध है, तो तारीख बदलना मुफ़्त है। उससे कम समय में, या समय बदलने के लिए, हमें फ़ोन करें — हम जो बन पड़ेगा करेंगे।',
        },
      },
    ],
  },
  {
    id: 'academy',
    title: { en: 'Training academy', hi: 'ट्रेनिंग अकादमी' },
    items: [
      {
        id: 'learn',
        q: { en: 'Do you teach safa tying?', hi: 'क्या आप साफा बाँधना सिखाते हैं?' },
        a: {
          en: 'Yes. SafaKing Academy teaches the styles we tie professionally — at our centre, or in your own city once enough people there ask for a batch.',
          hi: 'हाँ। SafaKing अकादमी वही स्टाइल सिखाती है जो हम पेशेवर रूप से बाँधते हैं — हमारे सेंटर पर, या आपके अपने शहर में जब वहाँ पर्याप्त लोग बैच के लिए कहें।',
        },
      },
      {
        id: 'certificate',
        q: { en: 'Do I get a certificate?', hi: 'क्या सर्टिफिकेट मिलता है?' },
        a: {
          en: 'Students who complete a course and pass are certified by SafaKing, and can then apply to take bookings through the platform.',
          hi: 'जो विद्यार्थी कोर्स पूरा करके पास होते हैं उन्हें SafaKing का सर्टिफिकेट मिलता है, और वे प्लेटफ़ॉर्म के ज़रिए बुकिंग लेने के लिए आवेदन कर सकते हैं।',
        },
      },
    ],
  },
  {
    id: 'work-with-us',
    title: { en: 'Artists and suppliers', hi: 'आर्टिस्ट और सप्लायर' },
    items: [
      {
        id: 'join-artist',
        q: { en: 'I tie safas. How do I get bookings through SafaKing?', hi: 'मैं साफा बाँधता हूँ। SafaKing से बुकिंग कैसे मिलेगी?' },
        a: {
          en: 'Apply through the artist portal with your experience, your city and photographs of your work. Once you are approved, jobs near you are offered to you in the portal.',
          hi: 'आर्टिस्ट पोर्टल से अपना अनुभव, शहर और अपने काम की फ़ोटो के साथ आवेदन करें। मंज़ूरी के बाद, आपके आस-पास के काम पोर्टल में आपको भेजे जाते हैं।',
        },
      },
      {
        id: 'artist-payment',
        q: { en: 'How and when is an artist paid?', hi: 'आर्टिस्ट को भुगतान कैसे और कब मिलता है?' },
        a: {
          en: 'SafaKing collects from the customer and releases the artist’s payment after the job is completed. An artist never takes money from the customer.',
          hi: 'SafaKing ग्राहक से रकम लेता है और काम पूरा होने के बाद आर्टिस्ट का भुगतान जारी करता है। आर्टिस्ट ग्राहक से पैसे नहीं लेता।',
        },
      },
      {
        id: 'supplier',
        q: { en: 'Can I sell my safas on SafaKing?', hi: 'क्या मैं अपने साफे SafaKing पर बेच सकता हूँ?' },
        a: {
          en: 'Yes — register through the supplier portal. Once approved you can list your safas, and orders reach you through the portal.',
          hi: 'हाँ — सप्लायर पोर्टल से रजिस्टर करें। मंज़ूरी के बाद आप अपने साफे लिस्ट कर सकते हैं, और ऑर्डर पोर्टल के ज़रिए आप तक पहुँचते हैं।',
        },
      },
    ],
  },
  {
    id: 'account',
    title: { en: 'Account and contact', hi: 'अकाउंट और संपर्क' },
    items: [
      {
        id: 'app',
        q: { en: 'Is there a SafaKing app?', hi: 'क्या SafaKing का ऐप है?' },
        a: {
          en: 'Yes, an Android app with the same account as the website — your bookings and orders are the same in both.',
          hi: 'हाँ, एक Android ऐप है जिसमें वेबसाइट वाला ही अकाउंट चलता है — आपकी बुकिंग और ऑर्डर दोनों जगह एक ही रहते हैं।',
        },
      },
      {
        id: 'delete-account',
        q: { en: 'How do I delete my account?', hi: 'अपना अकाउंट कैसे डिलीट करें?' },
        a: {
          en: 'Ask for deletion from the Delete Account page on the website, or from More in the app. Bookings and invoices we are required to keep for tax are kept; the rest is removed.',
          hi: 'वेबसाइट के Delete Account पेज से, या ऐप में More से डिलीट करने के लिए कहें। टैक्स के लिए जो बुकिंग और इनवॉइस रखना ज़रूरी है वे रखे जाते हैं; बाकी सब हटा दिया जाता है।',
        },
      },
      {
        id: 'contact',
        q: { en: 'How do I reach a person?', hi: 'किसी व्यक्ति से बात कैसे करें?' },
        a: {
          en: 'Call or WhatsApp the number at the bottom of any page, Monday to Saturday, 10 AM to 8 PM. Our office is in Narol, Ahmedabad.',
          hi: 'किसी भी पेज के नीचे दिए नंबर पर सोमवार से शनिवार, सुबह 10 से रात 8 बजे तक फ़ोन या WhatsApp करें। हमारा ऑफ़िस नरोल, अहमदाबाद में है।',
        },
      },
    ],
  },
];

/** Every question, flattened — for the structured data. */
export const FAQ_ITEMS: FaqItem[] = FAQ_GROUPS.flatMap((group) => group.items);
