# Real-Time Patterns — WebSocket, SSE, Long Polling

## Índice
1. Quando Usar Qual
2. Server-Sent Events (SSE)
3. WebSocket
4. Long Polling
5. Comparação de Performance
6. Scaling Real-Time

---

## 1. Quando Usar Qual

```
Preciso de real-time...
│
├── Server → Client only (notificações, feeds, dashboards)?
│   └── SSE (Server-Sent Events)
│       Simples, HTTP padrão, reconexão automática
│
├── Bidirecional (chat, colaboração, games)?
│   └── WebSocket
│       Full-duplex, baixa latência, protocolo próprio
│
├── Atualizações infrequentes (< 1 por minuto)?
│   └── Long Polling
│       Funciona em qualquer lugar, sem infra especial
│
└── Nada do acima (REST resolve)?
    └── Polling normal com intervalo
        GET /api/status a cada 30s
```

| Feature | SSE | WebSocket | Long Polling |
|---------|-----|-----------|-------------|
| Direção | Server → Client | Bidirecional | Server → Client |
| Protocolo | HTTP | ws:// | HTTP |
| Reconexão | Automática | Manual | Manual |
| Firewall-friendly | Sim | Nem sempre | Sim |
| Binary data | Não (text only) | Sim | Sim |
| Scaling | Fácil | Complexo (sticky sessions) | Fácil |
| Melhor para | Feeds, notificações | Chat, games, colaboração | Fallback |

---

## 2. Server-Sent Events (SSE)

### Server (Node.js)

```javascript
// Endpoint SSE
router.get('/api/events', authenticate, (req, res) => {
  // Headers obrigatórios
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx: desabilitar buffer

  // Enviar heartbeat a cada 30s (manter conexão viva)
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n'); // Comentário SSE (ignorado pelo client)
  }, 30000);

  // Função para enviar evento
  function sendEvent(event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n`);
    res.write(`id: ${Date.now()}\n`); // Para reconexão automática
    res.write('\n');
  }

  // Registrar listener (Redis pub/sub, EventEmitter, etc.)
  const userId = req.user.id;
  const channel = `user:${userId}:events`;

  const subscriber = redis.duplicate();
  subscriber.subscribe(channel);
  subscriber.on('message', (ch, message) => {
    const { event, data } = JSON.parse(message);
    sendEvent(event, data);
  });

  // Cleanup quando client desconecta
  req.on('close', () => {
    clearInterval(heartbeat);
    subscriber.unsubscribe(channel);
    subscriber.quit();
  });
});

// Publicar evento de qualquer lugar do app
async function notifyUser(userId, event, data) {
  await redis.publish(`user:${userId}:events`, JSON.stringify({ event, data }));
}

// Uso
await notifyUser(order.userId, 'order:updated', { orderId: order.id, status: 'shipped' });
```

### Client (Browser)

```javascript
const eventSource = new EventSource('/api/events', {
  headers: { 'Authorization': `Bearer ${token}` }, // Requer polyfill
});

// Ou com fetch API (mais controle)
async function connectSSE() {
  const response = await fetch('/api/events', {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    // Parse SSE format: "event: xxx\ndata: xxx\n\n"
    processSSEMessage(text);
  }
}

// EventSource padrão (sem custom headers — auth via cookie ou query)
const es = new EventSource(`/api/events?token=${token}`);

es.addEventListener('order:updated', (event) => {
  const data = JSON.parse(event.data);
  console.log('Order updated:', data);
  updateUI(data);
});

es.addEventListener('notification', (event) => {
  const data = JSON.parse(event.data);
  showNotification(data.title, data.message);
});

es.onerror = () => {
  console.log('SSE connection lost, reconnecting...');
  // EventSource reconecta automaticamente com Last-Event-ID
};
```

---

## 3. WebSocket

### Server (com socket.io)

```javascript
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
  transports: ['websocket', 'polling'], // WebSocket first, polling fallback
});

// Redis adapter (para múltiplas instâncias do servidor)
const pubClient = redis.duplicate();
const subClient = redis.duplicate();
io.adapter(createAdapter(pubClient, subClient));

// Middleware de autenticação
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.sub;
    next();
  } catch {
    next(new Error('Authentication error'));
  }
});

// Conexão
io.on('connection', (socket) => {
  logger.info('User connected', { userId: socket.userId, socketId: socket.id });

  // Entrar na room do user (para mensagens direcionadas)
  socket.join(`user:${socket.userId}`);

  // Ouvir eventos do client
  socket.on('chat:message', async (data) => {
    const { roomId, content } = data;

    // Validar e salvar
    const message = await chatService.createMessage({
      roomId, content, userId: socket.userId
    });

    // Broadcast para todos na room
    io.to(`room:${roomId}`).emit('chat:message', {
      id: message.id,
      content: message.content,
      userId: message.userId,
      createdAt: message.createdAt,
    });
  });

  socket.on('chat:typing', (data) => {
    socket.to(`room:${data.roomId}`).emit('chat:typing', {
      userId: socket.userId,
    });
  });

  socket.on('disconnect', () => {
    logger.info('User disconnected', { userId: socket.userId });
  });
});

// Enviar evento de qualquer lugar do app
function notifyUser(userId, event, data) {
  io.to(`user:${userId}`).emit(event, data);
}
```

### Client

```javascript
import { io } from 'socket.io-client';

const socket = io(SOCKET_URL, {
  auth: { token: accessToken },
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10,
});

socket.on('connect', () => console.log('Connected'));
socket.on('disconnect', (reason) => console.log('Disconnected:', reason));

socket.on('chat:message', (msg) => addMessageToUI(msg));
socket.on('order:updated', (data) => updateOrderStatus(data));

// Enviar
socket.emit('chat:message', { roomId: 'room-123', content: 'Hello!' });
```

---

## 4. Long Polling

```javascript
// Server — endpoint que segura a conexão até ter dado novo
router.get('/api/updates', authenticate, async (req, res) => {
  const since = req.query.since || '0';
  const timeout = 30000; // 30s max wait

  const startTime = Date.now();

  // Tentar buscar updates
  while (Date.now() - startTime < timeout) {
    const updates = await updateService.getAfter(req.user.id, since);
    if (updates.length > 0) {
      return res.json({
        data: updates,
        lastId: updates[updates.length - 1].id,
      });
    }
    // Esperar 1s e tentar de novo
    await new Promise(r => setTimeout(r, 1000));
  }

  // Timeout sem updates
  res.json({ data: [], lastId: since });
});

// Client
async function pollForUpdates(lastId = '0') {
  try {
    const response = await fetch(`/api/updates?since=${lastId}`, {
      signal: AbortSignal.timeout(35000),
    });
    const { data, lastId: newLastId } = await response.json();

    if (data.length > 0) {
      data.forEach(processUpdate);
    }

    // Reconectar imediatamente
    pollForUpdates(newLastId);
  } catch (error) {
    // Reconectar com delay em caso de erro
    setTimeout(() => pollForUpdates(lastId), 5000);
  }
}
```

---

## 5. Comparação de Performance

| Métrica | SSE | WebSocket | Long Polling |
|---------|-----|-----------|-------------|
| Latência | Baixa (~10ms) | Muito baixa (~5ms) | Média (~1s) |
| Overhead por mensagem | Baixo (HTTP chunks) | Mínimo (2 bytes frame) | Alto (full HTTP) |
| Conexões simultâneas | ~10K por server | ~10K por server | ~1K por server |
| Memory per connection | ~10KB | ~50KB | ~100KB |
| CPU overhead | Baixo | Baixo | Alto (re-establish) |

---

## 6. Scaling Real-Time

```
Problema: com N servidores, user pode estar conectado ao server 1,
mas o evento é publicado no server 2. Como garantir entrega?

Solução: Redis Pub/Sub como backbone

Server 1 ←→ Redis Pub/Sub ←→ Server 2
   ↕                              ↕
User A                         User B

Qualquer server publica no Redis.
Todos os servers escutam e entregam para seus clients conectados.
```

```javascript
// Socket.IO com Redis adapter já faz isso automaticamente:
import { createAdapter } from '@socket.io/redis-adapter';
io.adapter(createAdapter(pubClient, subClient));

// Para SSE: implementar manualmente com Redis Pub/Sub
// Cada server subscribes nos canais dos users conectados a ele
```
