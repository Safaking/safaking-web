/**
 * The photo gallery — SafaKing's own photographs, grouped the way a visitor
 * looks for them.
 *
 * Every file in public/gallery is a 1200px WebP made from the original
 * photograph (the originals stay where they are, for the pages that use
 * them). The same list feeds the page and its structured data, so what
 * Google indexes for image search is exactly what is on screen.
 *
 * Each caption is written to describe the photograph truthfully — it is the
 * alt text a screen reader reads out, and the text an image search matches.
 */

export type GalleryCategory = 'grooms' | 'safas' | 'artists' | 'academy';

export interface GalleryPhoto {
  src: string;
  width: number;
  height: number;
  category: GalleryCategory;
  alt: { en: string; hi: string };
}

export const GALLERY_CATEGORIES: { id: GalleryCategory; label: { en: string; hi: string } }[] = [
  { id: 'grooms', label: { en: 'Grooms', hi: 'दूल्हे' } },
  { id: 'safas', label: { en: 'Safas', hi: 'साफे' } },
  { id: 'artists', label: { en: 'Our artists', hi: 'हमारे आर्टिस्ट' } },
  { id: 'academy', label: { en: 'Academy', hi: 'अकादमी' } },
];

export const GALLERY: GalleryPhoto[] = [
  {
    src: '/gallery/groom-complete.webp', width: 896, height: 1200, category: 'grooms',
    alt: { en: 'Groom in a maroon sherwani wearing a gold SafaKing safa with kalgi', hi: 'मरून शेरवानी में दूल्हा, सुनहरा SafaKing साफा और कलगी के साथ' },
  },
  {
    src: '/gallery/groom_main.webp', width: 1000, height: 1000, category: 'grooms',
    alt: { en: 'Groom wearing a royal wedding safa', hi: 'शाही शादी का साफा पहने दूल्हा' },
  },
  {
    src: '/gallery/hero-groom-maroon.webp', width: 746, height: 1000, category: 'grooms',
    alt: { en: 'Groom in a deep maroon safa tied in the Jodhpuri style', hi: 'जोधपुरी स्टाइल में बँधा गहरा मरून साफा पहने दूल्हा' },
  },
  {
    src: '/gallery/groom-accessories.webp', width: 896, height: 1200, category: 'grooms',
    alt: { en: 'Groom safa finished with kalgi, brooch and pearl strings', hi: 'कलगी, ब्रोच और मोती की लड़ियों के साथ सजा दूल्हा साफा' },
  },
  {
    src: '/gallery/step1-sherwani.webp', width: 896, height: 1200, category: 'grooms',
    alt: { en: 'The groom look begins with a hand-embroidered Zardozi sherwani', hi: 'दूल्हे का लुक हाथ की ज़रदोज़ी कढ़ाई वाली शेरवानी से शुरू होता है' },
  },
  {
    src: '/gallery/step4-bindi.webp', width: 896, height: 1200, category: 'grooms',
    alt: { en: 'Groom styling with bindi and traditional jewellery before the safa', hi: 'साफे से पहले बिंदी और पारंपरिक गहनों के साथ दूल्हे की सजावट' },
  },
  {
    src: '/gallery/step5-safa.webp', width: 896, height: 1200, category: 'grooms',
    alt: { en: 'The safa going on — the moment the groom look is completed', hi: 'साफा पहनाया जा रहा है — वही पल जब दूल्हे का लुक पूरा होता है' },
  },
  {
    src: '/gallery/step6-complete.webp', width: 896, height: 1200, category: 'grooms',
    alt: { en: 'The finished royal groom look, safa and sehra together', hi: 'पूरा शाही दूल्हा लुक, साफा और सेहरा साथ में' },
  },

  {
    src: '/gallery/jodhpuri-safa.webp', width: 896, height: 1200, category: 'safas',
    alt: { en: 'Jodhpuri safa with sharp pleats and a tall crown', hi: 'तीखी प्लेट और ऊँचे मुकुट वाला जोधपुरी साफा' },
  },
  {
    src: '/gallery/rounded-gol-safa.webp', width: 896, height: 1200, category: 'safas',
    alt: { en: 'Rounded gol safa, the softer everyday wedding style', hi: 'गोल साफा — शादी की नरम, रोज़मर्रा वाली स्टाइल' },
  },
  {
    src: '/gallery/barati-safa-baraat.webp', width: 896, height: 1200, category: 'safas',
    alt: { en: 'Barati safas tied for wedding guests in the baraat', hi: 'बारात में मेहमानों के लिए बँधे बाराती साफे' },
  },
  {
    src: '/gallery/safa_gold.webp', width: 1000, height: 1000, category: 'safas',
    alt: { en: 'Gold wedding safa with zari work', hi: 'ज़री के काम वाला सुनहरा शादी का साफा' },
  },
  {
    src: '/gallery/safa-gold.webp', width: 1024, height: 1024, category: 'safas',
    alt: { en: 'Gold brocade safa photographed for the collection', hi: 'कलेक्शन के लिए खींचा गया सुनहरा ब्रोकेड साफा' },
  },
  {
    src: '/gallery/safa-jodhpuri.webp', width: 1024, height: 1024, category: 'safas',
    alt: { en: 'Jodhpuri safa in royal colours', hi: 'शाही रंगों में जोधपुरी साफा' },
  },
  {
    src: '/gallery/safa-maroon.webp', width: 1024, height: 1024, category: 'safas',
    alt: { en: 'Maroon groom safa ready to be dispatched', hi: 'भेजे जाने के लिए तैयार मरून दूल्हा साफा' },
  },
  {
    src: '/gallery/product-maroon-brocade.webp', width: 746, height: 1000, category: 'safas',
    alt: { en: 'Maroon brocade safa from the SafaKing shop', hi: 'SafaKing शॉप का मरून ब्रोकेड साफा' },
  },
  {
    src: '/gallery/product-pink-chanderi.webp', width: 746, height: 1000, category: 'safas',
    alt: { en: 'Pink Chanderi silk safa', hi: 'गुलाबी चंदेरी सिल्क साफा' },
  },
  {
    src: '/gallery/supplier_hub.webp', width: 1000, height: 746, category: 'safas',
    alt: { en: 'Safas stacked by colour at the SafaKing house', hi: 'SafaKing हाउस में रंगों के हिसाब से जमाए गए साफे' },
  },

  {
    src: '/gallery/artist_tying.webp', width: 1000, height: 746, category: 'artists',
    alt: { en: 'A SafaKing artist tying a safa at a wedding', hi: 'शादी में साफा बाँधता हुआ SafaKing आर्टिस्ट' },
  },
  {
    src: '/gallery/artist-jodhpuri-blue.webp', width: 746, height: 1000, category: 'artists',
    alt: { en: 'Artist finishing a blue Jodhpuri safa for a guest', hi: 'मेहमान के लिए नीला जोधपुरी साफा पूरा करता आर्टिस्ट' },
  },

  {
    src: '/gallery/training-artist-teaching.webp', width: 1000, height: 746, category: 'academy',
    alt: { en: 'A master artist teaching safa tying at SafaKing Academy', hi: 'SafaKing अकादमी में साफा बाँधना सिखाते मास्टर आर्टिस्ट' },
  },
  {
    src: '/gallery/training-class-students.webp', width: 1000, height: 746, category: 'academy',
    alt: { en: 'Students practising safa tying in an academy batch', hi: 'अकादमी के बैच में साफा बाँधने का अभ्यास करते विद्यार्थी' },
  },
  {
    src: '/gallery/training-closeup-hands.webp', width: 1000, height: 746, category: 'academy',
    alt: { en: 'Close-up of hands setting the pleats of a safa', hi: 'साफे की प्लेट बनाते हाथों का नज़दीकी दृश्य' },
  },
  {
    src: '/gallery/training_academy.webp', width: 1000, height: 746, category: 'academy',
    alt: { en: 'A SafaKing Academy training session in progress', hi: 'चल रहा SafaKing अकादमी का ट्रेनिंग सेशन' },
  },
];
