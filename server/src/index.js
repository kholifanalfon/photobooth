require('dotenv').config();
const { app } = require('./app');

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Photobooth Server] Listening on port ${PORT} (0.0.0.0)`);
});

module.exports = server;
