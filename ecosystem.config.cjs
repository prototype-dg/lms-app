module.exports = {
  apps: [
    {
      name: 'sohar-demo',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=sohar-demo-production --local --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        OPENAI_API_KEY: 'REDACTED_OPENAI_KEY',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
