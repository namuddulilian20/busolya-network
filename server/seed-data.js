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
];// ---------- Topics for every subject (not just Farm Aid) ----------
const ALL_TOPICS = [
  { subject_code: '01', code: 'fa-01', title: 'Land registration and ownership', summary: 'How to register land under Busolya and Butaka compartments.', level: 'foundation', sort_order: 1 },
  { subject_code: '01', code: 'fa-02', title: 'Clerk duties and land records', summary: 'Clerk registers land owners and labourers; records at least one transaction per Lunyiriri or village.', level: 'practical', sort_order: 2 },
  { subject_code: '01', code: 'fa-03', title: 'Verifier duties and ownership vetting', summary: 'Verifier vets ownership and validity of transactions and payments; at least one per Mutuba or parish.', level: 'practical', sort_order: 3 },
  { subject_code: '01', code: 'fa-04', title: 'Aggregator duties and stock inventory', summary: 'Aggregator takes stock of all items received and produced; at least one per Mutuba or parish.', level: 'practical', sort_order: 4 },
  { subject_code: '01', code: 'fa-05', title: 'Courier duties and quality transport', summary: 'Courier vets quality and transports items; at least one per Lunyiriri or village.', level: 'practical', sort_order: 5 },
  { subject_code: '01', code: 'fa-06', title: 'Registrar duties and payment clearing', summary: 'Registrar clears payments and settles disputes; one per Ssiga or Ssaza.', level: 'practical', sort_order: 6 },
  { subject_code: '01', code: 'fa-07', title: 'Commissioner for stock and inventory', summary: 'Commissioner oversees stock and inventory; at least one per Mutuba or Ssaza.', level: 'practical', sort_order: 7 },
  { subject_code: '01', code: 'fa-08', title: 'Committee reports from Abobusolya', summary: 'Committee receives registrar and commissioner reports; structured by clan location per Ssaza.', level: 'practical', sort_order: 8 },
  { subject_code: '02', code: 'ac-01', title: 'Input and labour book', summary: 'Daily record of seeds, tools, feeds and labour hours per plot.', level: 'foundation', sort_order: 1 },
  { subject_code: '02', code: 'ac-02', title: 'Stock and asset book', summary: 'Inventory of tools, livestock, stored produce and their values.', level: 'foundation', sort_order: 2 },
  { subject_code: '02', code: 'ac-03', title: 'Season summary and gross margin', summary: 'Income, costs and profit per season.', level: 'practical', sort_order: 3 },
  { subject_code: '02', code: 'ac-04', title: 'Reading the numbers back to the SACCO', summary: 'Presenting farm records to the SACCO for credit decisions.', level: 'practical', sort_order: 4 },
  { subject_code: '03', code: 'cl-01', title: 'Olulyo, ssiga, mutuba, enju', summary: 'Clan structure from whole clan down to household.', level: 'foundation', sort_order: 1 },
  { subject_code: '03', code: 'cl-02', title: 'The council at each layer', summary: 'Who sits, who speaks, what the council decides and records.', level: 'foundation', sort_order: 2 },
  { subject_code: '03', code: 'cl-03', title: 'What a clan guarantees and what it does not', summary: 'Limits of clan responsibility for members’ debts.', level: 'practical', sort_order: 3 },
  { subject_code: '03', code: 'cl-04', title: 'Registering a member honestly', summary: 'Truthful enrolment in clan and SACCO registers.', level: 'practical', sort_order: 4 },
  { subject_code: '04', code: 'la-01', title: 'Mailo and kibanja in plain terms', summary: 'Registered owner, kibanja holder, and what each can do.', level: 'foundation', sort_order: 1 },
  { subject_code: '04', code: 'la-02', title: 'Busuulu and what a receipt must show', summary: 'Ground rent, receipt contents, landlord-tenant relationship.', level: 'practical', sort_order: 2 },
  { subject_code: '04', code: 'la-03', title: 'What belongs in a written agreement', summary: 'Parties, land description, term, rent, signatures and witnesses.', level: 'practical', sort_order: 3 },
  { subject_code: '04', code: 'la-04', title: 'Where a dispute goes first', summary: 'Clan head, ssiga council, registrar, then courts.', level: 'foundation', sort_order: 4 },
  { subject_code: '05', code: 'cr-01', title: 'Savings before credit', summary: 'Why a member must save before the SACCO lends.', level: 'foundation', sort_order: 1 },
  { subject_code: '05', code: 'cr-02', title: 'How a loan file is read', summary: 'Purpose, amount, term, guarantors, repayment plan and security.', level: 'practical', sort_order: 2 },
  { subject_code: '05', code: 'cr-03', title: 'What a guarantor is signing', summary: 'Liability, release conditions and default consequences.', level: 'practical', sort_order: 3 },
  { subject_code: '05', code: 'cr-04', title: 'Recovery without breaking the clan', summary: 'Collecting arrears while keeping clan relationships intact.', level: 'practical', sort_order: 4 },
  { subject_code: '06', code: 'ag-01', title: 'Cassava: planting material and mosaic control', summary: 'Clean cuttings, field hygiene and roguing infected plants.', level: 'practical', sort_order: 1 },
  { subject_code: '06', code: 'ag-02', title: 'Banana: mat management and wilt', summary: 'Sucker selection, mat hygiene and BXW control.', level: 'practical', sort_order: 2 },
  { subject_code: '06', code: 'ag-03', title: 'Coffee: stumping, shade, drying', summary: 'Renewing old trees, shade management and safe drying.', level: 'practical', sort_order: 3 },
  { subject_code: '06', code: 'ag-04', title: 'Maize: spacing, fertiliser, storage', summary: 'Plant spacing, fertiliser rates and grain storage.', level: 'practical', sort_order: 4 },
  { subject_code: '07', code: 'lv-01', title: 'Feed and water economics', summary: 'Cost of feed per kg of gain; water access and quality.', level: 'practical', sort_order: 1 },
  { subject_code: '07', code: 'lv-02', title: 'Housing and ventilation', summary: 'Coop and stall design, drainage and disease prevention.', level: 'practical', sort_order: 2 },
  { subject_code: '07', code: 'lv-03', title: 'Vaccination calendar', summary: 'Timing, records and the vet relationship.', level: 'practical', sort_order: 3 },
  { subject_code: '07', code: 'lv-04', title: 'Breeding records and culling', summary: 'Sire selection, kidding/lambing records and culling.', level: 'practical', sort_order: 4 },
  { subject_code: '08', code: 'ph-01', title: 'Drying to safe moisture', summary: 'Moisture targets for maize, beans, coffee and cassava chips.', level: 'practical', sort_order: 1 },
  { subject_code: '08', code: 'ph-02', title: 'Storage without pests', summary: 'Hermetic bags, stores, fumigation and stock checks.', level: 'practical', sort_order: 2 },
  { subject_code: '08', code: 'ph-03', title: 'Grading and packaging', summary: 'Grade standards, packaging materials and labelling.', level: 'practical', sort_order: 3 },
  { subject_code: '08', code: 'ph-04', title: 'What certification costs and returns', summary: 'Certification fees, premium prices and whether it pays.', level: 'foundation', sort_order: 4 },
  { subject_code: '09', code: 'di-01', title: 'Being listed in the directory', summary: 'How to get found by buyers, exhibitors and financiers.', level: 'foundation', sort_order: 1 },
  { subject_code: '09', code: 'di-02', title: 'Answering a demand lead', summary: 'Responding to visitor requests with price, quantity and terms.', level: 'practical', sort_order: 2 },
  { subject_code: '09', code: 'di-03', title: 'Selling on WhatsApp without losing money', summary: 'Photos, prices, payment terms and delivery cost.', level: 'practical', sort_order: 3 },
  { subject_code: '09', code: 'di-04', title: 'Keeping a buyer after the first order', summary: 'Records, follow-up and repeat business.', level: 'practical', sort_order: 4 },
];
// ---------- English notes for every topic ----------
const ALL_NOTES_EN = [
  { topic_code: 'fa-01', title: 'Land Registration and Ownership', content: 'Register land under Busolya or Butaka compartments. The clerk records owners, labourers and at least one transaction per Lunyiriri or village.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'fa-02', title: 'Clerk Duties: Registering Owners and Labourers', content: 'The clerk registers land owners and labourers and records at least one transaction per Lunyiriri or village.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'fa-03', title: 'Verifier Duties: Vetting Ownership and Payments', content: 'The verifier checks ownership documents and validates transactions and payments. At least one verifier per Mutuba or parish.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'fa-04', title: 'Aggregator Duties: Stock and Inventory', content: 'The aggregator takes stock of all items received and produced. At least one aggregator per Mutuba or parish.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'fa-05', title: 'Courier Duties: Quality Vetting and Transport', content: 'The courier vets quality and transports items between locations. At least one courier per Lunyiriri or village.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'fa-06', title: 'Registrar Duties: Clearing Payments and Settling Disputes', content: 'The registrar clears payments and settles disputes. One registrar per Ssiga or Ssaza.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'fa-07', title: 'Commissioner for Stock and Inventory', content: 'The commissioner oversees stock and inventory across the network. At least one per Mutuba or Ssaza.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'fa-08', title: 'Committee Reports from Abobusolya', content: 'The committee receives registrar and commissioner reports. Reports are structured by clan location per Ssaza.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'ac-01', title: 'Input and Labour Book', content: 'Record every seed bag, tool, feed sack and labour hour per plot each day.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'ac-02', title: 'Stock and Asset Book', content: 'List all tools, livestock, stored produce and their current values. Update after every harvest and sale.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'ac-03', title: 'Season Summary and Gross Margin', content: 'Add up season income, subtract input and labour costs. Gross margin per acre and per crop.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'ac-04', title: 'Reading the Numbers Back to the SACCO', content: 'Take your season summary to the SACCO. It shows repayment capacity and supports credit applications.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'cl-01', title: 'Olulyo, Ssiga, Mutuba, Enju', content: 'Olulyo is the whole clan. Ssiga is a branch. Mutuba carries the family name. Enju is the household that farms, saves and guarantees.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'cl-02', title: 'The Council at Each Layer', content: 'Each clan layer has a council: clan heads at olulyo, ssiga heads at ssiga, mutuba heads at mutuba.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'cl-03', title: 'What a Clan Guarantees and What It Does Not', content: 'A clan can vouch for a member’s character but does not pay another member’s debts unless it agrees in writing.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'cl-04', title: 'Registering a Member Honestly', content: 'Give true names, village and clan when registering. False names break credit, directory and SACCO records.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'la-01', title: 'Mailo and Kibanja in Plain Terms', content: 'Mailo is the registered title. Kibanja is the occupant’s right to live on and use the land.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'la-02', title: 'Busuulu and What a Receipt Must Show', content: 'Busuulu is ground rent paid to the mailo owner. A receipt shows date, amount, parties, land description and signatures.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'la-03', title: 'What Belongs in a Written Agreement', content: 'Names of parties, land description, term, rent, obligations of each side, signatures and witnesses.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'la-04', title: 'Where a Dispute Goes First', content: 'Start with the clan head, then the ssiga council, then the registrar, and only then the courts.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'cr-01', title: 'Savings Before Credit', content: 'A SACCO member saves first. Savings build the member’s share and prove repayment discipline before any loan.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'cr-02', title: 'How a Loan File Is Read', content: 'Purpose, amount, term, guarantors, repayment plan and security. A complete file gets decided faster.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'cr-03', title: 'What a Guarantor Is Signing', content: 'The guarantor signs to cover the loan if the borrower does not pay. Release when repaid or guarantor replaced.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'cr-04', title: 'Recovery Without Breaking the Clan', content: 'Collect arrears through the registrar and clan councils first. Courts are the last resort.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'ag-01', title: 'Cassava: Planting Material and Mosaic Control', content: 'Use clean cuttings from healthy plants. Remove and burn mosaic-infected plants.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'ag-02', title: 'Banana: Mat Management and Wilt', content: 'Choose healthy suckers, manage mat density, and cut out banana bacterial wilt plants immediately.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'ag-03', title: 'Coffee: Stumping, Shade, Drying', content: 'Stump old trees to renew them. Keep shade trees. Dry cherry on raised tables to safe moisture.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'ag-04', title: 'Maize: Spacing, Fertiliser, Storage', content: 'Plant at recommended spacing. Apply fertiliser at planting and top-dressing. Store grain dry.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'lv-01', title: 'Feed and Water Economics', content: 'Work out the cost of feed per kilogram of weight gain. Water must be clean and available at all times.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'lv-02', title: 'Housing and Ventilation', content: 'Build coops and stalls with drainage, light and airflow. Overcrowding spreads disease.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'lv-03', title: 'Vaccination Calendar', content: 'Follow the vaccination schedule for poultry and livestock. Keep a record of every shot and date.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'lv-04', title: 'Breeding Records and Culling', content: 'Record sire, dam, service date and birth date. Cull animals that do not breed, grow or produce.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'ph-01', title: 'Drying to Safe Moisture', content: 'Maize to 13%, beans to 14%, coffee to 12%. Use a moisture meter or the salt test.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'ph-02', title: 'Storage Without Pests', content: 'Use hermetic bags or clean stores. Check stock monthly. Fumigate only when needed.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'ph-03', title: 'Grading and Packaging', content: 'Sort by size, colour and quality. Use clean bags. Label with crop, grade, date and farmer.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'ph-04', title: 'What Certification Costs and Returns', content: 'Certification costs money and time. It pays only if buyers pay a premium covering cost plus profit.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'di-01', title: 'Being Listed in the Directory', content: 'Register in the directory so buyers, exhibitors and financiers can find you. Keep phone, sector and district current.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'di-02', title: 'Answering a Demand Lead', content: 'Reply to visitor requests with price, quantity, delivery date and terms. Fast answers win orders.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'di-03', title: 'Selling on WhatsApp Without Losing Money', content: 'Post clear photos, state prices, set payment terms and include delivery cost in the quote.', locale: 'en', format: 'text', price_ugx: 5000 },
  { topic_code: 'di-04', title: 'Keeping a Buyer After the First Order', content: 'Record the buyer’s phone, what they bought and when. Follow up. Repeat business is cheaper.', locale: 'en', format: 'text', price_ugx: 5000 },
];


module.exports = { SUBJECTS, QUESTIONS, LAYERS, NETWORKS, FARM_AID_TOPICS, FARM_AID_NOTES_EN, FARM_AID_NOTES_LUG, ALL_TOPICS, ALL_NOTES_EN };
