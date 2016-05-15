program = require 'commander'
fs = require 'fs'
Path = require 'path'
defaultsDeep = require 'lodash.defaultsdeep'
#yaml = require 'js-yaml'

class BUXCli

  commands:
    login:
      desc: 'Login to BUX account and create config'
    find:
      title: 'find [<pattern>]'
      aliases: [ 'f' ]
      desc: 'Products list'
      options: [
        [ '-f, --favorite', 'Show favorite products' ]
        [ '-o, --only-open', 'Show open products' ]
        [ '--category [cat]', 'Filter by category' ]
        [ '--status [OPEN|CLOSED]', 'Filter by market status' ]
        [ '-s, --sort [column]', 'Sort table' ]
        [ '-c, --columns [columns]', 'Select columns to show' ]
        [ '-l, --list-columns', 'List available columns for sort or view' ]
      ]

    product:
      title: 'product <product-id>'
      desc: 'Info about specified product'
      aliases: [ 'pro' ]
    positions:
      title: 'positions [<pattern>]'
      desc: 'Portfolio overview'
      aliases: [ 'p' ]
      options: [
        [ '-s, --sort [column]', 'Sort table' ]
        [ '-c, --columns [columns]', 'Select columns to show' ]
        [ '-l, --list-columns', 'List available columns for sort or view' ]
        [ '-w, --watch', 'Refresh in specified interval' ]
        [ '-i, --interval [s]', 'Watch interval' ]
      ]
    position:
      title: 'position <position-id>'  
      desc: 'Info about specified position'
      aliases: [ 'pos' ]
    open:
      title: 'open <product-id> <direction> <trade-size> <leverage>'
      desc: 'Open position'
      aliases: [ 'o' ]
    close:
      title: 'close [<position-id>]'
      aliases: [ 'c' ]
      desc: 'Close position'
    fees:
      title: 'fees'
      desc: 'Fees'
    autoclose:
      title: 'autoclose <position-id>'
      aliases: [ 'ac' ]
      desc: 'Set autoclose values to position'
    balance:
      title: 'balance'
      desc: 'Account balance'
      aliases: [ 'b' ]
    history:
      title: 'history [<pattern>]'
      desc: 'Trade history'
      aliases: [ 'h' ]
      options: [
        [ '-s, --sort [column]', 'Sort table' ]
      ]
    me:
      title: 'me'
      desc: 'Info about you'
    profile:
      desc: 'Basic account info'
      aliases: [ 'pr' ]
    friends:
      title: 'friends [<pattern>]'
      aliases: [ 'fr' ]
      desc: 'List your friends'
      options: [
        [ '-s, --sort [column]', 'Sort table' ]
        [ '-c, --columns [columns]', 'Select columns to show' ]
        [ '-l, --list-columns', 'List available columns for sort or view' ]
      ]
    exec:
      title: 'exec <command> [<arguments>]'
      aliases: [ 'e' ]
      desc: 'Execute raw libbux command'

  config: {}
  cmdProgram: null
  loadedModules: {}

  userConfig:
    aliases:
      directions:
        BUY: '+, up, buy'
        SELL: '-, down, sell'
    positions:
      columns: 'short_id, product, product_ident, type, amount, leverage, trade_price, price, change, profit, age'
      sort: '!change'
    friends:
      columns: 'short_id, nickname, country, type, title, since'
      sort: 'nickname'
    find:
      columns: 'id, name, product_ident, category, max_leverage, status, price, change, favorite'
      sort: 'id'
    history:
      columns: 'short_id, type, product, product_ident, amount, leverage, price, profit, status, order_type, age'
      sort: '!created'

  constructor: ->
    @version = JSON.parse(fs.readFileSync(Path.resolve(__dirname, '..', 'package.json'))).version
    @loadProgram (cmd) =>
      @run(cmd)

  modules: (arr, callback) ->
    output = []
    for mi in arr
      if @loadedModules[mi]
        mod = @loadedModules[mi]
      else
        mod = require(mi)
        @loadedModules[mi] = mod
      output.push mod
    callback.apply(null, output)

  getVersion: ->
    @modules [ 'libbux' ], (BUX) =>
      return "#{@version} (libbux #{BUX.version})"

  run: (cmd) ->
    @debug "Running command: #{cmd}"

    @modules [ 'libbux' ], (BUX) =>
      buxConfig =
        server: @program.server || @userConfig.server
        access_token: @userConfig.account?.access_token
        no_symbols: true

      @userConfig.symbols = defaultsDeep BUX.symbols, @userConfig.symbols

      BUX.api buxConfig, (@bux) =>
        @['cmd_'+cmd] (err, output) =>
          if err
            @exception(err)
          if !output
            @exception('endpoint not found')
          else if typeof(output) == 'string'
            console.log output
          else
            if @program.json
              console.log JSON.stringify(output.json)
            else if output.text
              console.log output.text
          @debug 'Done.'

  exception: (err) ->
    console.log "Error: #{err}"
    process.exit 10

  loadProgram: (callback) ->
    @program = program
      .usage '[options] <command>'
      .version @getVersion()
      .option '-d, --debug', 'print verbose debug output to stdout'
      .option '-j, --json', 'output in json'
      .option '--server <address>', 'server api address'

    aliases = {}

    cmd = null
    cmdProgram = null
    for cmdKey, cmdData of @commands
      title = cmdKey
      if cmdData.title
        title = cmdData.title
      pc = @program.command title
        .description cmdData.desc

      if cmdData.aliases
        for alias in cmdData.aliases
          aliases[alias] = cmdKey
        cmdData.aliases.map (opt) -> pc = pc.alias(opt)

      if cmdData.options
        cmdData.options.map (opt) -> pc = pc.option(opt[0], opt[1])

      pc = pc.action () ->
        program = arguments[Object.keys(arguments).length-1]
        cmd = program._name
        cmdProgram = program
        outArgs = []
        for arg in arguments
          if typeof(arg) != 'object'
            outArgs.push arg

        cmdProgram.parsedArgs = outArgs

    # ensure aliases
    args = process.argv.slice()
    if aliases[args[2]]
      args[2] = aliases[args[2]]

    @program.parse args
    @cmdProgram = cmdProgram

    if @program.debug
      process.env.DEBUG = 'bux:*,libbux:*,superagent:*'
      @debug = require('debug')('bux:main')
      @debug 'Debug mode enabled.'
    else
      @debug = -> return null

    if cmd == null
      @program.outputHelp()
      process.exit 0
    else if !@['cmd_'+cmd]
      @exception "Command not exists: #{cmd}"
    else if cmd == 'login'
      callback(cmd)
    else
      @loadUserConfig =>
        callback(cmd)

  getPrompt: (schema, callback) ->
    prompt = require 'prompt'
    prompt.message = ''
    prompt.delimited = ''
    prompt.start()

    prompt.get schema, (err, result) ->
      prompt.stop()
      callback err, result

  cmd_open: (callback) ->
    args = @cmdProgram.parsedArgs
    query = 
      product: @resolveProductId args[0]
      direction: @resolveDirection args[1]
      size: args[2]
      multiplier: args[3]

    if !query.direction
      return callback "bad direction: #{args[1]}"
    if (new Number(query.size) <= 0)
      return callback "bad size: #{query.size}"
    if (new Number(query.multiplier) <= 0)
      return callback "bad multiplier: #{query.multiplier}"

    @bux.open query, (err, output) =>
      if err then return @exception err

      productId = @getSymbol(output.product.securityId) || output.product.securityId
      created = new Date(new Number(output.dateCreated)).toString()

      text = "Position successfully opened!\n" +
        "  Trade Id: #{output.id}\n" +
        "  Type: #{output.type}\n" +
        "  Position Id: #{output.positionId}\n" +
        "  Product: #{output.product.displayName} [#{productId}]\n" +
        "  Direction: #{output.direction}\n" +
        "  Trade size: #{output.investingAmount.amount}\n" +
        "  Multiplier: #{output.leverage}\n" +
        "  Current price: #{output.price.amount}\n" +
        "  Time: #{created}"

        callback null, { text: text, json: output }

  cmd_close: (callback) ->
    args = @cmdProgram.parsedArgs
    positionId = args[0]
    if !positionId then return callback 'no position id'

    @bux.close positionId, (err, output) =>
      if err then return callback err

      productId = @getSymbol(output.product.securityId) || output.product.securityId
      created = new Date(new Number(output.dateCreated)).toString()

      text = "Position closed!\n" +
        "  Trade Id: #{output.id}\n" +
        "  Type: #{output.type}\n" +
        "  Position Id: #{output.positionId}\n" +
        "  Product: #{output.product.displayName} [#{productId}]\n" +
        "  Direction: #{output.direction}\n" +
        "  Trade size: #{output.investingAmount.amount}\n" +
        "  Multiplier: #{output.leverage}\n" +
        "  Close price: #{output.price.amount}\n" +
        "  Profit: #{output.profitAndLoss.amount} #{output.profitAndLoss.currency}\n" +
        "  Time: #{created}"

      callback null, { text: text, json: output }

  cmd_me: (callback) ->
    @bux.me (err, data) =>
      if err then return @exception err
      callback null, { text: JSON.stringify(data, null, 2), json: data }

  cmd_help: (callback) ->
    program.outputHelp()
    callback null, null

  cmd_login: (callback) ->
    console.log "Welcome to BUX terminal interface!"
    console.log 'Please specify your account details'

    schema =
      properties:
        email: { description: 'Email' }
        password: { description: 'Password', hidden: true }

    @getPrompt schema, (err, account) =>
      @debug "Logging to BUX [email=#{account.email}] .."
      @bux.login account, (err, data) =>
        if err or !data.access_token
          return @exception 'Login error'

        @debug "Login done. Saving .."
        @saveUserConfig 'account', { access_token: data.access_token }, () ->
          callback null, { text: 'Login done! Welcome abroad.', json: data }

  cmd_history: (callback) ->

    columns =
      id:
        name: 'Id'
        key: 'id'
      short_id:
        name: 'Trade Id'
        render: (x) -> return x.id.substring 0, 8
      category:
        name: 'Category'
        key: 'product.category'
      product:
        name: 'Product'
        key: 'product.displayName'
      product_id:
        name: 'Product Id'
        key: 'product.securityId'
      product_ident:
        name: 'Product Id'
        render: (x) => return @resolveProductSymbol(x.product.securityId)
      type:
        name: 'Type'
        key: 'direction'
      status:
        name: 'Status'
        key: 'type'
      leverage:
        name: '× M'
        key: 'leverage'
      price:
        name: 'Trade price'
        key: 'price.amount'
        align: 'RIGHT'
      amount:
        name: 'Amount'
        key: 'investingAmount.amount'
        align: 'RIGHT'
      change:
        name: 'Change'
        align: 'RIGHT'
        sortRank: (x) -> x.rendered.change.replace(/[\+]+/,'')
        render: (x) =>
          return ''
          #return @calcDiff(x.currentPrice.amount, x.tradePrice.amount, x.leverage, x.type)
      created:
        name: 'Created'
        key: 'dateCreated'
      age:
        name: 'Age'
        sortRank: (x) -> x.pos.dateCreated
        render: (x) -> return require('moment')(x.dateCreated).fromNow(true).toString()
      profit:
        name: 'Profit'
        align: 'RIGHT'
        render: (x) -> return (x.profitAndLoss?.amount || '')
      order_type:
        name: 'Status type'
        key: 'orderType'

    table = @createTable columns, 'History', 'product'

    if @cmdProgram.listColumns
      data = table.listColumns()
      return callback null, { text: data.table.toString(), json: data.columns }

    if typeof(@program.args[0]) == "string"
      table.setSearch @program.args[0]

    table.setLayout @cmdProgram.columns || @userConfig.history.columns
    table.setSort @cmdProgram.sort || @userConfig.history.sort

    finishView = (table, data) =>
      table.titleFn = @createTitleFn("History")
      return table.render(data)

    @bux.trades (err, x) =>
      if err then return @exception(err)
      text = finishView(table, x)
      callback null, { text: text, json: x }

  cmd_positions: (callback) ->

    columns =
      id:
        name: 'Id'
        key: 'id'
      short_id:
        name: 'Trade Id'
        render: (x) -> return x.id.substring 0, 8
      category:
        name: 'Category'
        key: 'product.category'
      product:
        name: 'Product'
        key: 'product.displayName'
      product_id:
        name: 'Product Id'
        key: 'product.securityId'
      product_ident:
        name: 'Product Id'
        render: (x) => return @resolveProductSymbol(x.product.securityId)
      leverage:
        name: '× M'
        key: 'leverage'
      type:
        name: 'Type'
        key: 'type'
      trade_price:
        name: 'Trade price'
        key: 'tradePrice.amount'
        align: 'RIGHT'
      price:
        name: 'Price'
        key: 'currentPrice.amount'
        align: 'RIGHT'
      profit:
        name: 'Profit'
        align: 'RIGHT'
        render: (x) -> return (x.profitAndLoss?.amount || '')
      amount:
        name: 'Amount'
        key: 'investedAmount.amount'
        align: 'RIGHT'
      opened:
        name: 'Opened'
        key: 'openingsDate'
      age:
        name: 'Age'
        sortRank: (x) -> x.pos.openingsDate
        render: (x) ->
          return require('moment')(x.openingsDate).fromNow(true).toString()
      change:
        name: 'Change'
        align: 'RIGHT'
        sortRank: (x) -> x.rendered.change.replace(/[\+]+/,'')
        render: (x) =>
          return @calcDiff(x.currentPrice.amount, x.tradePrice.amount, x.leverage, x.type)

    table = @createTable columns, 'positions', 'product'

    if @cmdProgram.listColumns
      data = table.listColumns()
      return callback null, { text: data.table.toString(), json: data.columns }

    if typeof(@program.args[0]) == "string"
      table.setSearch @program.args[0]

    table.setLayout @cmdProgram.columns || @userConfig.positions.columns
    table.setSort @cmdProgram.sort || @userConfig.positions.sort

    finishView = (table, data) =>
      table.titleFn = @createTitleFn("Positions")
      return table.render(data)

    if @cmdProgram.watch
      interval = @cmdProgram.interval
      if !interval
        interval = 10

      term = require( 'terminal-kit' ).terminal
      term.fullscreen({ noAlternate: true })
      #term.hideCursor()

      renderView = () =>
        @bux.portfolio (err, x) =>
          if err then return @exception(err)
          term.clear()
          term finishView(table, x.positions)
          term "\nLast updated: #{ new Date }"

      renderView()
      setInterval renderView, interval * 1000
    
    else
      @bux.portfolio (err, x) =>
        if err then return @exception(err)
        text = finishView(table, x.positions)
        callback null, { text: text, json: x.positions }

  getSymbol: (productId, showAll=false) ->
    if @userConfig.symbols[productId]
      str = '@'+@userConfig.symbols[productId]
      if !showAll 
        return str.split('/')[0]
      return str
    return null

  resolveDirection: (dir) ->
    if @userConfig.aliases.directions?
      for dk, da of @userConfig.aliases.directions
        for d in da.split(',').map((x) -> x.trim())
          if d == dir then dir = dk
          continue

    if dir not in [ 'SELL', 'BUY' ] then return false
    return dir

  resolveProductSymbol: (id) ->
    symbol = @bux.findSymbolByProduct(id)
    if !symbol then return id
    return "@#{symbol}"
    
  resolveProductId: (id) ->
    symbol = @bux.findProductBySymbol id, @userConfig.symbols
    return symbol || id

  cmd_position: (callback) ->
    positionId = @cmdProgram.parsedArgs[0]

    @debug "Getting position: #{positionId}"
    @bux.position positionId, (err, pos) =>
      callback err, { text: JSON.stringify(pos, null, 2), json: pos }

  cmd_fees: (callback) ->
    @bux.fees (err, fees) =>
      callback null, { text: JSON.stringify(fees, null, 2), json: fees }

  cmd_product: (callback) ->
    productId = @resolveProductId @cmdProgram.parsedArgs[0]
    @debug "Getting product: #{productId}"

    params =
      securityId:
        name: 'Id'
      displayName:
        name: 'Name'
      favorite:
        name: 'Favorite'
      category:
        name: 'Category'
      maxLeverage:
        name: 'Max multiplier'
      description:
        name: 'Description'

    table = @createTableSimple params, "Product", 'key'

    @bux.product productId, (err, product) =>
      if err then return @exception(err)
      if !product then return @exception "Product not found: #{productId}"

      matrix = table.processSimpleData(product, params)
      callback null, { text: table.render(matrix), json: product }

  cmd_profile: (callback) ->
    params =
      id:
        name: 'Id'
      nickname:
        name: 'Nickname'
      avatarUrl:
        name: 'Avatar URL'
      countryCode:
        name: 'Country'
      title:
        name: 'Title'
      tradingStats:
        name: 'Trading Stats'
      accountType:
        name: 'Account Type'
      level:
        name: 'Level'

    table = @createTableSimple params, "Profile [#{@userConfig.account.username}]", 'key'

    @bux.profile (err, x) =>
      if err then return @exception(err)

      matrix = table.processSimpleData(x, params)
      callback null, { text: table.render(matrix), json: x }

  cmd_find: (callback) ->

    columns =
      id:
        key: 'securityId'
        name: 'Id'
      name:
        name: 'Name'
        key: 'displayName'
      max_leverage:
        name: 'Max ×'
        key: 'maxLeverage'
      category:
        name: 'Category'
        key: 'category'
      favorite:
        name: 'Favorite'
        key: 'favorite'
      status:
        name: 'Status'
        key: 'productMarketStatus'
      price:
        name: 'Price'
        key: 'currentPrice.amount'
      change:
        name: 'Change'
        align: 'RIGHT'
        sortRank: (x) -> x.rendered.change.replace(/[\+]+/,'')
        render: (x) =>
          return @calcDiff(x.closingPrice.amount, x.currentPrice.amount, 1)
      product_ident:
        name: 'Product Id'
        render: (x) => return @resolveProductSymbol(x.securityId)
      symbol:
        name: 'Symbol'
        render: (x) => return @getSymbol(x.securityId)
      symbols:
        name: 'Symbols'
        render: (x) => return @getSymbol(x.securityId, true)
          
    table = @createTable columns, null, 'name'

    if @cmdProgram.listColumns
      data = table.listColumns()
      return callback null, { text: data.table.toString(), json: data.columns }

    @bux.products (err, x) =>
      if err then return @exception(err)

      if typeof(@program.args[0]) == "string"
        table.setSearch @program.args[0]

      table.filterFn = (item) =>
        status = true
        if @cmdProgram.favorite
          status = (if item.favorite then true else false)
        if status and @cmdProgram.status
          status = (item.productMarketStatus == @cmdProgram.status)
        else if status and @cmdProgram.onlyOpen
          status = (item.productMarketStatus == 'OPEN')
        return status

      table.titleFn = @createTitleFn("Products")
      table.setLayout @cmdProgram.columns || @userConfig.find.columns
      table.setSort @cmdProgram.sort || @userConfig.find.sort

      callback null, { text: table.render(x), json: x }

  cmd_exec: (callback, args) ->
    args = @program.args.map((x) -> return (if typeof x == 'string' and x != '' then x else false))
    args = args.filter((x) -> return x != false)
    args.push (err, data) -> callback null, { text: JSON.stringify(data, null, 2), json: data }

    cmd = args.shift()
    if !@bux[cmd] then return callback null, 'Bad command: '+cmd
    @bux[cmd].apply @bux, args

  cmd_friends: (callback) ->

    columns =
      id:
        key: 'id'
        name: 'Id'
      short_id:
        name: 'Id'
        render: (x) -> return x.id.substring 0, 8
      nickname:
        key: 'nickname'        
        name: 'Nickname'
      title:
        key: 'title'
        name: 'Title'
      country:
        key: 'countryCode'
        name: 'Country'
      type:
        key: 'accountType'
        name: 'Account type'
      since:
        name: 'Friend since'
        render: (x) ->
          return require('moment')(x.friendSince).fromNow(true).toString()
      since_time:
        name: 'Friend since (date)'
        key: 'friendSince'

    table = @createTable columns, null, 'nickname'

    if @cmdProgram.listColumns
      data = table.listColumns()
      return callback null, { text: data.table.toString(), json: data.columns }

    @bux.friends (err, x) =>
      if err then return @exception(err)

      if typeof(@program.args[0]) == "string"
        table.setSearch @program.args[0]

      table.titleFn = @createTitleFn("Friends")
      table.setLayout @cmdProgram.columns || @userConfig.friends.columns
      table.setSort @cmdProgram.sort || @userConfig.friends.sort

      callback null, { text: table.render(x), json: x }

  verifyProduct: (productId) ->

  createTable: (columns, name, defaultColumn) ->
    Table = require './table'
    table = new Table(columns, defaultColumn, name)
    return table

  createTableSimple: (params, name, defaultColumn) ->
    columns =
      param:
        key: 'key'
        name: 'Key'
        align: 'RIGHT'
      value:
        key: 'value'        
        name: 'Value'

    table = @createTable columns, name, defaultColumn
    table.showHeader = false
    table.setLayout 'param,value'

    if typeof(@program.args[0]) == "string"
      table.setSearch @program.args[0]

    return table

  createTitleFn: (title) ->
    return (counter, product) =>
      return "#{title} (#{counter}) [#{@userConfig.account.username}]"

  getConfigFilename: () ->
    return Path.join(process.env.HOME, '.bux-config.json')

  saveUserConfig: (key, val, callback) ->
    @debug "Saving config: key=#{key} value=#{val}"
    fn = @getConfigFilename()
    if fs.existsSync fn
      output = JSON.parse(fs.readFileSync(fn))
    else
      output = {}

    output[key] = val
    fs.writeFile fn, JSON.stringify(output, null, 2), =>
      @debug "Config saved: #{fn}"
      callback()

  loadUserConfig: (callback) ->
    fn = @getConfigFilename()
    @debug "Loading config from #{fn} .."
    if !fs.existsSync fn
      @exception "Config file #{fn} not exists.\nPlease use `bux login` to create a new one."

    config = JSON.parse fs.readFileSync(fn)
    @userConfig = defaultsDeep config, @userConfig
    @debug "Config loaded: #{JSON.stringify(@userConfig, null, 2)}"

    callback()

  calcDiff: (current, traded, leverage=1, type="SHORT") ->
    diff = current - traded
    numb = new Number((diff/(traded/100)) * leverage).toFixed(2)
    if type == 'SHORT'
      numb = new Number(-numb).toFixed(2)
    if numb>0 then numb = "+"+numb
    return numb+'%'


module.exports =
  version: BUXCli.version
  run: -> return new BUXCli

