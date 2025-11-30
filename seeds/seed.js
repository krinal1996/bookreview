// seed/seed.js
const { MongoClient } = require('mongodb');
const data = require('./books.json');

async function run(){
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGO_DB || 'bookreview';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection('books');
  await col.deleteMany({});
  await col.insertMany(data);
  console.log('Seeded books into', uri, dbName);
  await client.close();
}

run().catch(err => { console.error(err); process.exit(1); });
