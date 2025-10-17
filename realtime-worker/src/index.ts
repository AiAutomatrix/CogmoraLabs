import http from 'http';

// This is a placeholder server. In the next step, we will replace this
// with the actual WebSocket client logic to connect to KuCoin and
// interact with Firestore.

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Real-time worker is running. Ready to connect to WebSockets.\\n');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
