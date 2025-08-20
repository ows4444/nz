import { killPort } from '@nx/node/utils';
 

module.exports = async function () {
  // Put clean up logic here (e.g. stopping services, docker-compose, etc.).
  // Hint: `globalThis` is shared between setup and teardown.
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  try {
    console.log(`Attempting to close port ${port}`);
    await killPort(port);
    console.log(`Port ${port} successfully closed`);
  } catch (error) {
    console.log(`Warning: Could not kill port ${port}:`, error instanceof Error ? error.message : String(error));
  }

  console.log(globalThis.__TEARDOWN_MESSAGE__);
};
