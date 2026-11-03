// Seed content. Every insert is idempotent: re-running the seed never duplicates
// a row and never overwrites a row an administrator has edited.

const SUBJECTS = [
  {
    code: '01',
    title: 'Farm Aid: managing a farm',
    summary: 'Preparing the manager; husbandry, planning, labour and supervision.',
    level: 'foundation',
    outline: ['Who manages, who supervises, who does', 'Season plan and labour calendar', 'Records a manager keeps daily', 'Supervising casual labour and sharecroppers']
  },
  {
    code: '02',
    title: 'Farm accountancy',
    summary: 'Daily input and labour book, stock book, season summary.',
    level: 'foundation',
    outline: ['Input and labour book', 'Stock and asset book', 'Season summary and gross margin', 'Reading the numbers back to the SACCO']
  },
  {
    code: '03',
    title: 'Abasolya, Bataka and clan layers',
    summary: 'Ekika to enju; councils; the Katikkiro at each layer; what allegiance carries.',
    level: 'foundation',
    outline: ['Olulyo, ssiga, mutuba, enju', 'The council at each layer', 'What a clan guarantees and what it does not', 'Registering a member honestly']
  },
  {
    code: '04',
    title: 'Land, tenure and dues',
    summary: 'Mailo, kibanja, busuulu; what belongs in an agreement.',
    level: 'foundation',
    outline: ['Mailo and kibanja in plain terms', 'Busuulu and what a receipt must show', 'What belongs in a written agreement', 'Where a dispute goes first']
  },
  {
    code: '05',
    title: 'Credit, savings and guarantors',
    summary: 'How a SACCO reads a member; what a guarantor signs.',
    level: 'foundation',
    outline: ['Savings before credit', 'How a loan file is read', 'What a guarantor is signing', 'Recovery without breaking the clan']
  },
  {
    code: '06',
    title: 'Agronomy clinic',
    summary: 'Cassava, banana, coffee, maize.',
    level: 'practical',
    outline: ['Cassava: planting material and mosaic control', 'Banana: mat management and wilt', 'Coffee: stumping, shade, drying', 'Maize: spacing, fertiliser, storage']
  },
  {
    code: '07',
    title: 'Livestock and poultry',
    summary: 'Feeds, housing, disease control, breeding, records.',
    level: 'practical',
    outline: ['Feed and water economics', 'Housing and ventilation', 'Vaccination calendar', 'Breeding records and culling']
  },
  {
    code: '08',
    title: 'Post-harvest and standards',
    summary: 'Drying, storage, grading, packaging, certification.',
    level: 'practical',
    outline: ['Drying to safe moisture', 'Storage without pests', 'Grading and packaging', 'What certification costs and returns']
  },
  {
    code: '09',
    title: 'Digital and market access',
    summary: 'QR forms, the directory, WhatsApp selling, being found.',
    level: 'practical',
    outline: ['Being listed in the directory', 'Answering a demand lead', 'Selling on WhatsApp without losing money', 'Keeping a buyer after the first order']
  }
];

const QUESTIONS = {
  demand: [
    { field: 'goal', prompt: 'What did you come to the expo to find?', type: 'text', required: true },
    { field: 'first_need', prompt: 'Which product or service do you need first?', type: 'text', required: true },
    { field: 'volume', prompt: 'How much do you need per month?', type: 'select', options: ['Under 100 kg', '100-500 kg', '500 kg - 2 tonnes', 'Above 2 tonnes', 'Not sure yet'], required: true },
    { field: 'timing', prompt: 'When do you need it?', type: 'select', options: ['This week', 'This month', 'This season', 'Next season'], required: true },
    { field: 'payment', prompt: 'How will you pay?', type: 'select', options: ['Cash', 'Mobile money', 'SACCO credit', 'Contract after delivery'], required: true },
    { field: 'call_back', prompt: 'Do you want a supplier to call you?', type: 'yesno', required: true },
    { field: 'buy_district', prompt: 'Which district do you normally buy from?', type: 'text', required: false }
  ],
  supply: [
    { field: 'supplies', prompt: 'What do you supply?', type: 'text', required: true },
    { field: 'capacity', prompt: 'What is your monthly capacity?', type: 'text', required: true },
    { field: 'price_band', prompt: 'What price band do you sell at?', type: 'text', required: true },
    { field: 'delivery', prompt: 'How far do you deliver?', type: 'select', options: ['Within the sub-county', 'Within the district', 'Within the region', 'Nationwide'], required: true },
    { field: 'terms', prompt: 'Which payment terms do you accept?', type: 'select', options: ['Cash on delivery', 'Half on order', 'Credit to known buyers', 'Contract terms'], required: true },
    { field: 'finance_need', prompt: 'Do you need a guarantor or creditor to expand?', type: 'yesno', required: true },
    { field: 'standards', prompt: 'Which standard or certification do you hold?', type: 'text', required: false }
  ],
  linkage: [
    { field: 'meet', prompt: 'Who do you want to meet?', type: 'select', options: ['Input supplier', 'Buyer or off-taker', 'Processor', 'Transporter or logistics', 'Financier', 'Regulator or extension'], required: true },
    { field: 'deal', prompt: 'What deal are you offering?', type: 'text', required: true },
    { field: 'volume', prompt: 'What volume or value per month?', type: 'text', required: true },
    { field: 'partner_need', prompt: 'What do you need from a partner?', type: 'textarea', required: true },
    { field: 'timeline', prompt: 'When should the partnership start?', type: 'select', options: ['Immediately', 'Within a month', 'Next season', 'Exploring'], required: true },
    { field: 'listed', prompt: 'Should this appear in the public directory?', type: 'yesno', required: true },
    { field: 'contact_window', prompt: 'Best time to call you?', type: 'text', required: false }
  ]
};

const LAYERS = [
  { code: 'olulyo', name: 'Olulyo (clan)', kind: 'clan', parent: null, sort: 1, description: 'The clan as a whole, led by the Ow\'akasolya with the clan council.' },
  { code: 'ssiga', name: 'Ssiga (sub-clan)', kind: 'clan', parent: 'olulyo', sort: 2, description: 'A branch of the clan, usually tracing one founding house.' },
  { code: 'mutuba', name: 'Mutuba', kind: 'clan', parent: 'ssiga', sort: 3, description: 'The named line inside a ssiga; the layer that carries the family name.' },
  { code: 'enju', name: 'Enju (household)', kind: 'clan', parent: 'mutuba', sort: 4, description: 'The household: the unit that actually farms, saves and guarantees.' },
  { code: 'ssaza', name: 'Ssaza (county)', kind: 'admin', parent: null, sort: 11, description: 'Administrative county, led by the Ssaza chief.' },
  { code: 'gombolola', name: 'Gombolola (sub-county)', kind: 'admin', parent: 'ssaza', sort: 12, description: 'Sub-county, led by the Gombolola chief.' },
  { code: 'muluka', name: 'Muluka (parish)', kind: 'admin', parent: 'gombolola', sort: 13, description: 'Parish, where most expo marshals and desks sit.' },
  { code: 'kya', name: 'Kya (village)', kind: 'admin', parent: 'muluka', sort: 14, description: 'Village, the layer closest to the farmer.' }
];

const NETWORKS = [
  {
    kind: 'business',
    name: 'Busolya Biz Network',
    model: 'Membership, listing and matched demand. A member is verified once, listed in the yellow-pages directory, and receives demand leads that match the sector and district they registered. Revenue comes from annual membership, directory placement and a per-closed-deal facilitation fee agreed in writing before the introduction.',
    description: 'The business arm: suppliers, service providers and processors who want to be found, quoted and paid.'
  },
  {
    kind: 'trade',
    name: 'Bataka Trade Network',
    model: 'Aggregation and off-take. Farmers deliver to a named collection point at a published grade and price; the network bulks, transports and contracts to buyers. Every consignment gets a receipt with weight, grade and moisture; payment terms are printed on the receipt. Revenue comes from a fixed handling fee per kilogram, not from the farmgate price.',
    description: 'The trade arm: volume, grades, transport and contracts between the farm and the buyer.'
  }
];

const FARM_AID_TOPICS = [
  { subject_code: '01', code: 'fa-01', title: 'Land registration and ownership', summary: 'How to register land under the Busolya and Butaka compartments.', level: 'foundation', sort_order: 1 },
  { subject_code: '01', code: 'fa-02', title: 'Clerk duties and land records', summary: 'The clerk registers land owners and labourers and records at least one transaction per Lunyiriri or village.', level: 'practical', sort_order: 2 },
  { subject_code: '01', code: 'fa-03', title: 'Verifier duties and ownership vetting', summary: 'The verifier vets ownership and validity of transactions and payments, at least one per Mutuba or parish.', level: 'practical', sort_order: 3 },
  { subject_code: '01', code: 'fa-04', title: 'Aggregator duties and stock inventory', summary: 'The aggregator takes stock and inventory of all items and products received and produced, at least one per Mutuba or parish.', level: 'practical', sort_order: 4 },
  { subject_code: '01', code: 'fa-05', title: 'Courier duties and quality transport', summary: 'The courier vets quality and transports items and products from one place to another, at least one per Lunyiriri or village.', level: 'practical', sort_order: 5 },
  { subject_code: '01', code: 'fa-06', title: 'Registrar duties and payment clearing', summary: 'The registrar clears payments and settles disputes, one per Ssiga or Ssaza.', level: 'practical', sort_order: 6 },
  { subject_code: '01', code: 'fa-07', title: 'Commissioner for stock and inventory', summary: 'The commissioner oversees stock and inventory, at least one per Mutuba or Ssaza.', level: 'practical', sort_order: 7 },
  { subject_code: '01', code: 'fa-08', title: 'Committee and clan reports', summary: 'The committee selected by the abobusolya receives registrar and commissioner reports.', level: 'foundation', sort_order: 8 },
];

const FARM_AID_NOTES_EN = [
  { topic_code: 'fa-01', title: 'How to Register Land in Busolya and Butaka', content: 'Land registration under the Busolya (lineage establishment) compartment follows clan protocols. Under Butaka (residents establishment), residency and occupation are recorded. Both require the clerk to record at least one transaction per Lunyiriri or village.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'fa-02', title: 'Clerk Duties: Registering Owners and Labourers', content: 'The clerk is the first point of contact. They register land owners and labourers, and record transactions. There must be at least one clerk per Lunyiriri or village.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'fa-03', title: 'Verifier Duties: Vetting Ownership and Payments', content: 'The verifier checks ownership documents and validates transactions and payments. At least one verifier per Mutuba or parish.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'fa-04', title: 'Aggregator Duties: Stock and Inventory', content: 'The aggregator takes stock and inventory of all items and products received and produced. At least one aggregator per Mutuba or parish.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'fa-05', title: 'Courier Duties: Quality Vetting and Transport', content: 'The courier vets quality and transports items and products from one place to another. At least one courier per Lunyiriri or village.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'fa-06', title: 'Registrar Duties: Clearing Payments and Settling Disputes', content: 'The registrar clears payments and settles disputes. One registrar per Ssiga or Ssaza.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'fa-07', title: 'Commissioner for Stock and Inventory', content: 'The commissioner oversees stock and inventory across the network. At least one commissioner per Mutuba or Ssaza.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'fa-08', title: 'Committee Reports from Abobusolya', content: 'The committee is selected by the abobusolya to receive registrar and commissioner reports. Reports are structured for locating each clan in each Ssaza.', locale: 'en', format: 'text', price_ugx: 5000 },
];

const FARM_AID_NOTES_LUG = [
  { topic_code: 'fa-01', title: 'Okubaka Obulamu mu Busolya n\'Butaka', content: 'Obulamu bw\'obulimo mu Busolya (ekika kya botaka) tegereza amagufu g\'abalongo. Mu Butaka (obulamu bwaffe bwaffe), obulungi bw\'obulimi bwogererekwa. Bbiri bbeera n\'okubaka mu Lunyiriri amaaga ga kya clone.', locale: 'lug', format: 'luganda', price_ugx: 5000 },
  { topic_code: 'fa-02', title: 'Olugero lwa Clerk: Okubaka Ab\'akasolya n\'Abalasimu', content: 'Clerk ni omuntu wa kwanja oba baliko batyo. Yeyagala ab\'akasolya n\'abalasimu, n\'eyogera ebikumbi. Atiide one clerk mu Lunyiriri okukubaka.', locale: 'lug', format: 'luganda', price_ugx: 5000 },
  { topic_code: 'fa-03', title: 'Olugero lwa Verifier: Okulabirira Bulungi n\'Obuwendo', content: 'Verifier yeyatulira ensibo ya bulungi n\'eyogera ebikumbi n\'obuwaalo. Atiide one verifier mu Mutuba amaaga ga kya parish.', locale: 'lug', format: 'luganda', price_ugx: 5000 },
  { topic_code: 'fa-04', title: 'Olugero lwa Aggregator: Ebintu by\'okumala n\'ebya\'sisa', content: 'Aggregator yeyogeresa ebintu byonna by\'okumala n\'ebya\'sisa ebifulumidde n\'ebya\'sisidde. Atiide one aggregator mu Mutuba amaaga ga kya parish.', locale: 'lug', format: 'luganda', price_ugx: 5000 },
  { topic_code: 'fa-05', title: 'Olugero lwa Courier: Okulabirira Bulungi n\'Okutambala', content: 'Courier yeyatulira bulungi n\'eyokutambala ebyo byonna mu Lunyiriri amaaga ga kya village.', locale: 'lug', format: 'luganda', price_ugx: 5000 },
  { topic_code: 'fa-06', title: 'Olugero lwa Registrar: Okusaaba Obuwaalo n\'Okutegereza Amayembo', content: 'Registrar yeyasaaba obuwaalo n\'eyategereza amayembo. One registrar mu Ssiga okukubaka Ssaza.', locale: 'lug', format: 'luganda', price_ugx: 5000 },
  { topic_code: 'fa-07', title: 'Commissioner mu Ebintu by\'okumala n\'ebya\'sisa', content: 'Commissioner yeyokumala ebintu byonna by\'okumala n\'ebya\'sisa mu network. Atiide one commissioner mu Mutuba okukubaka Ssaza.', locale: 'lug', format: 'luganda', price_ugx: 5000 },
  { topic_code: 'fa-08', title: 'Ebikumbi bya Committee mu Abobusolya', content: 'Committee yeyagaliwa mu abobusolya eyogera ebikumbi bya registrar n\'commissioner. Ebikumbi bekyebwa mu ssanga ya bonna abakasolya mu Ssaza.', locale: 'lug', format: 'luganda', price_ugx: 5000 },
];

module.exports = { SUBJECTS, QUESTIONS, LAYERS, NETWORKS, FARM_AID_TOPICS, FARM_AID_NOTES_EN, FARM_AID_NOTES_LUG };
