// Minimal Server-Sent Events hub. Lets every connected kiosk/browser tab
// see check-in state changes the moment they happen, without polling.

const clients = new Set();

function addClient(res) {
  clients.add(res);
}

function removeClient(res) {
  clients.delete(res);
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    res.write(payload);
  }
}

module.exports = { addClient, removeClient, broadcast };
