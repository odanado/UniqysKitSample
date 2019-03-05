import { Router } from "express"
import Memcached from "memcached"

const DB_HOST = 'localhost'
const DB_PORT = 5652

const memcached = new Memcached(`${DB_HOST}:${DB_PORT}`)

const router = Router()

interface Message {
  id: number
  sender: string
  contents: string
  timestamp: string
  blockhash: string
}

async function getMessages (count: number): Promise<Message[]> {
  return new Promise((resolve, reject) => {
    if (!count) return resolve([])
    const ids = new Array(count).fill(0).map((_, i) => i + 1) // XXX: fill(0)いる？
    memcached.getMulti(ids.map(id => `messages:${id}`), (err, results) => {
      if (err) return reject(err)
      resolve(ids.map(id => Object.assign({ id }, results[`messages:${id}`])))
    })
  })
}

async function getCount (): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    memcached.get('messages', (err, result) => {
      if (err) return reject(err)
      if (typeof result === 'number') return resolve(result)
      resolve(0)
    })
  })
}

async function incrCount (): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    memcached.incr('messages', 1, (err, result) => {
      if (err) return reject(err)
      if (typeof result === 'number') return resolve(result)
      memcached.set('messages', 1, 0, (err) => {
        if (err) return reject(err)
        resolve(1)
      })
    })
  })
}

router.get('/message', async (_, res) => {
  const count = await getCount()
  const messages = await getMessages(count)
  res.send({ messages });
});

router.post('/message', async (req, res) => {
  const sender = req.header('uniqys-sender')
  const timestamp = req.header('uniqys-timestamp')
  const blockhash = req.header('uniqys-blockhash')
  const { contents } = req.body

  const count = await incrCount()

  memcached.set(`messages:${count}`, { sender, timestamp, blockhash, contents }, 0, (err) => {
    if (err) {
      res.status(400).send(err)
    }
    else {
      res.sendStatus(200)
    }
  })
})

export = router