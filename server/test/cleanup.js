const { teardownTestEnvironment } = require('./testHelper');

async function run() {
  await teardownTestEnvironment();
  process.exit(0);
}

run().catch((err) => {
  console.error('Test cleanup encountered an error:', err);
  process.exit(0);
});
