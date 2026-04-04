import app from './app.js';
import { config } from './utils/config.js';

app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
  console.log(`Health check: http://localhost:${config.port}/health`);
});

export default app;
