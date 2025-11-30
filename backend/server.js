// backend/server.js
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const redis = require('redis');
const promClient = require('prom-client');
const morgan = require('morgan');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(morgan('tiny'));
app.use(cors()); // safe if you use Ingress same-origin; harmless otherwise

// Prometheus metrics
promClient.collectDefaultMetrics();
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method','route','code']
});

const endTimer = (res, route, start) => {
  const code = res.statusCode || 200;
  start({ method: res.req?.method || 'GET', route, code });
};

function withMetrics(route, handler){
  return async (req,res) => {
    const done = httpRequestDuration.startTimer();
    try {
      await handler(req,res);
      done({ method: req.method, route, code: res.statusCode });
    } catch (err){
      done({ method: req.method, route, code: 500 });
      console.error(err);
      res.status(500).json({ error: String(err) });
    }
  }
}

const PORT = process.env.PORT || 4000;
//const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo-service:27017';
const MONGO_URI = process.env.MONGO_URI || `mongodb://${process.env.MONGO_INITDB_ROOT_USERNAME || ''}:${process.env.MONGO_INITDB_ROOT_PASSWORD || ''}@mongo-service:27017/${MONGO_DB}?authSource=admin`;
const MONGO_DB = process.env.MONGO_DB || 'bookreview';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

let db, books;
let redisClient;

async function start() {
  // Redis
  redisClient = redis.createClient({ url: REDIS_URL });
  redisClient.on('error', (e) => console.error('Redis error', e));
  await redisClient.connect();

  // Mongo
  const mongo = new MongoClient(MONGO_URI);
  await mongo.connect();
  db = mongo.db(MONGO_DB);
  books = db.collection('books');

  console.log('Connected to MongoDB and Redis');
}

start().catch(err => { console.error('Startup error', err); process.exit(1); });

// metrics endpoint
app.get('/metrics', async (req,res) => {
  try {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  } catch (e) {
    res.status(500).end(e.toString());
  }
});

// health check
app.get('/_healthz', (req,res) => res.status(200).send('OK'));

// list books with simple redis caching
app.get('/api/books', withMetrics('/api/books', async (req,res) => {
  const cached = await redisClient.get('books:list');
  if (cached) return res.json(JSON.parse(cached));
  const list = await books.find({}).toArray();
  await redisClient.setEx('books:list', 30, JSON.stringify(list));
  res.json(list);
}));

// get single book
app.get('/api/books/:id', withMetrics('/api/books/:id', async (req,res) => {
  const id = req.params.id;
  const b = await books.findOne({ _id: new ObjectId(id) });
  if (!b) return res.status(404).json({ error: 'not found' });
  res.json(b);
}));

// post a review
app.post('/api/books/:id/reviews', withMetrics('/api/books/:id/reviews', async (req,res) => {
  const id = req.params.id;
  const review = { text: req.body.text, author: req.body.author || 'anon', createdAt: new Date() };
  await books.updateOne({ _id: new ObjectId(id) }, { $push: { reviews: review } });
  // invalidate cache
  await redisClient.del('books:list');
  res.status(201).json(review);
}));

app.listen(PORT, () => console.log(`API listening on ${PORT}`));
