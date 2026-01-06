export default {
  schema: './src/test-schema',
  out: './housekit',
  databases: {
    default: {
      url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
      database: process.env.CLICKHOUSE_DB || 'default',
      username: process.env.CLICKHOUSE_USER || 'admin',
      password: process.env.CLICKHOUSE_PASSWORD || 'admin'
    }
  }
};
