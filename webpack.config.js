const path = require('path');

module.exports = {
  mode: 'production',
  entry: path.join(__dirname, 'app', 'index'),
  output: {
    path: path.join(__dirname, 'dist'),
    publicPath: '/dist/',
    filename: "bundle.js",
    chunkFilename: '[name].js'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.json', '.js', '.ts'],
    alias: {
      '@': path.resolve(__dirname, 'app')
    }
  },
  optimization: {
    usedExports: 'global'
  },
  devtool: false,
  target: 'node8.13'
};