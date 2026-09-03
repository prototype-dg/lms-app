module.exports = {
  apps: [
    {
      name: 'lms-portal',
      script: 'node',
      args: 'server.js',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'production',
        PORT: '8080',
        DB_PATH: '/home/user/webapp/data/app.db',
        DEMO_MODE: 'true'
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
