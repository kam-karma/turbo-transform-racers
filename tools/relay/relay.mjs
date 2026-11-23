// Dev-only local relay: saves POSTed files (browser snapshots, generated assets) into a folder. Not shipped.
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
const DIR = process.argv[2]
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Private-Network': 'true' }
createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const name = basename(url.searchParams.get('name') || '')
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
  if (!/^[\w.-]+$/.test(name)) { res.writeHead(400, cors); return res.end('bad name') }
  const file = join(DIR, name)
  if (req.method === 'POST') {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => { writeFileSync(file, Buffer.concat(chunks)); res.writeHead(200, cors); res.end(`saved ${name} ${Buffer.concat(chunks).length}`) })
    return
  }
  if (!existsSync(file)) { res.writeHead(404, cors); return res.end('missing') }
  const type = name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.png') ? 'image/png' : name.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream'
  res.writeHead(200, { ...cors, 'Content-Type': type }); res.end(readFileSync(file))
}).listen(5199, '127.0.0.1', () => console.log('relay on 5199 ->', DIR))
