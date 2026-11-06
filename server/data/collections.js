'use strict';

const { Collection } = require('./store');

const COLLECTION_NAMES = [
  'submissions',
  'visitors',
  'suppliers',
  'directory_entries',
  'questions',
  'subjects',
  'education_sessions',
  'governance_layers',
  'governance_units',
  'networks',
  'members',
  'contacts',
  'settings',
  'participants',
  'users',
  'user_sessions',
  'supplier_products',
  'demand_stock',
  'education_topics',
  'education_notes',
  'education_presentations',
  'education_shares',
  'sacco_members',
  'sacco_transactions',
  'sacco_creditors',
  'sacco_guarantors',
  'farm_aid_roles',
  'farm_aid_reports',
  'supplier_directory_link',
  'supplier_media',
  'purchase_orders',
  'low_stock_alerts'
];

const stores = {};
COLLECTION_NAMES.forEach(name => {
  stores[name] = new Collection(name);
});

function get(name) {
  if (!stores[name]) throw new Error(`Unknown collection: ${name}`);
  return stores[name];
}

function all() {
  return { ...stores };
}

module.exports = { get, all, COLLECTION_NAMES };
