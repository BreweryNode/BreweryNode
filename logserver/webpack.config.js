const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
var path = require('path');
var globEntries = require('webpack-glob-entries');
var webpack = require('webpack');
var nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: globEntries('./src/main/**/*.js'),
  output: {
    path: path.resolve(__dirname, 'output'),
    filename: '[name].js',
    publicPath: ''
  },
  target: 'node',
  node: {
    __dirname: true
  },
  externals: ['pg', 'sqlite3', 'tedious', 'pg-hstore', 'pg-native', nodeExternals()],
  plugins: [
    new UglifyJsPlugin({
      parallel: true,
      cache: true,
      sourceMap: true
    })
  ]
};
