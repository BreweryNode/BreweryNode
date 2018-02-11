module.exports = {
  apps: [
    {
      name: 'Splash',
      script: './src/main/index.js',
      watch: false,
      env: {
        NODE_ENV: 'development'
      },
      envProduction: {
        NODE_ENV: 'production'
      }
    }
  ]
};
