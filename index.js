const Promise = require('bluebird')
const { MongoClient } = require('mongodb')
const faker = require('faker')
const {
  always,
  map,
  merge,
  range,
  tap,
} = require('ramda')

const MAX_LANES = 2
const MAX_SEGMENTS = 10
const MAX_EQUIPMENTS = 10
const MAX_RECORDS = 60

function save(db, collection, document) {
  console.log(db)
  return db[collection].insert(document)
    .then(always(document))
    .then(tap(console.log))
    .catch(always(new Error(`Error inserting random ${collection}`)))
}

function randomEquipment (db, segmentId) {
  const latitude = faker.address.latitude()
  const longitude = faker.address.longitude()

  const equipment = {
    location: {
      type: 'Point',
      coordinates: [
        latitude,
        longitude,
      ],
    },
    segmentId,
  }

  return save(db, 'equipments', equipment)
}

function randomReport(db, equipmentId) {
  const records = range(1, MAX_RECORDS).map(() => ({
    speed: faker.random.number() % 100,
    length: faker.random.number() % 120,
    lane: faker.random.number() % MAX_LANES,
  }))

  const time = faker.date.past()

  const report = {
    time,
    equipmentId,
    records,
  }

  return save(db, 'reports', report)
}

function randomSegment(db) {
  const segment = {
    name: `BR-${faker.random.number() % 100}`
  }

  return save(db, 'segments', segment)
}

async function randomSeed (db) {
  const numSegments = faker.random.number() % MAX_SEGMENTS
  const segments = Array.from({ lenth: numSegments })

  for (let i = 0; i < numSegments; i++) {
    const segment = segments[i] = await randomSegment(db)

    const numEquipments = faker.random.number() % MAX_EQUIPMENTS
    const equipments = []
    for (let i = 0; i < numEquipments; i++) {
      const equipment = equipments[i] = await randomEquipment(db, segment._id)

      const numReports = parseInt(faker.random.number() / 100)
      equipment.reports = Array.from({ length: numReports })

      for (let i = 0; i < numReports; i++) {
        equipment.reports[i] = await randomReport(db, equipment._id)
      }
    }
  }

  return segments
}

function connect (collections) {
  return MongoClient.connect(process.env.MONGO_URL)
    .then(db => collections.reduce(
      (acc, coll) => merge(acc, { [coll]: db.collection(coll) }),
      {}
    ))
}

async function seed () {
  const db = await connect(['segments', 'equipments', 'reports'])

  return randomSeed(db)
    .then(tap(db.close.bind(db)))
    .catch(tap(db.close.bind(db)))
}

seed()
  .then(console.log)
  .catch(console.error)

