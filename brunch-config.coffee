module.exports =
  paths:
    public: 'dist'
    watched: [ 'src' ]
  files:
    javascripts:
      joinTo:
        'cli.js': /^src\/cli/
        'table.js': /^src\/table/
  plugins:
    coffeescript:
      bare: true
  modules:
    wrapper: false
