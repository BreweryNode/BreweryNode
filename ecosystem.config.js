module.exports = {
  apps: [
    {
      name: 'logserver',
      script: './logserver/src/main/index.js',
      watch: true,
      env: {
        NODE_ENV: 'development'
      },
      envProduction: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'bubblerserver',
      script: './bubblerserver/src/main/index.js',
      watch: true,
      env: {
        NODE_ENV: 'development'
      },
      envProduction: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'flowserver',
      script: './flowserver/src/main/index.js',
      watch: true,
      env: {
        NODE_ENV: 'development'
      },
      envProduction: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'temperatureserver',
      script: './temperatureserver/src/main/index.js',
      watch: true,
      env: {
        NODE_ENV: 'development'
      },
      envProduction: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'volumeserver',
      script: './volumeserver/src/main/index.js',
      watch: true,
      env: {
        NODE_ENV: 'development'
      },
      envProduction: {
        NODE_ENV: 'production'
      }
    }
  ]
};
