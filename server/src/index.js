require('dotenv').config();
const { app } = require('./app');

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`[Photobooth Server] Listening on port ${PORT}`);
});

module.exports = server;
