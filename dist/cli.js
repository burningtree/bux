(function() {
  'use strict';

  var globals = typeof window === 'undefined' ? global : window;
  if (typeof globals.require === 'function') return;

  var modules = {};
  var cache = {};
  var aliases = {};
  var has = ({}).hasOwnProperty;

  var expRe = /^\.\.?(\/|$)/;
  var expand = function(root, name) {
    var results = [], part;
    var parts = (expRe.test(name) ? root + '/' + name : name).split('/');
    for (var i = 0, length = parts.length; i < length; i++) {
      part = parts[i];
      if (part === '..') {
        results.pop();
      } else if (part !== '.' && part !== '') {
        results.push(part);
      }
    }
    return results.join('/');
  };

  var dirname = function(path) {
    return path.split('/').slice(0, -1).join('/');
  };

  var localRequire = function(path) {
    return function expanded(name) {
      var absolute = expand(dirname(path), name);
      return globals.require(absolute, path);
    };
  };

  var initModule = function(name, definition) {
    var module = {id: name, exports: {}};
    cache[name] = module;
    definition(module.exports, localRequire(name), module);
    return module.exports;
  };

  var expandAlias = function(name) {
    return aliases[name] ? expandAlias(aliases[name]) : name;
  };

  var require = function(name, loaderPath) {
    if (loaderPath == null) loaderPath = '/';
    var path = expandAlias(name);

    if (has.call(cache, path)) return cache[path].exports;
    if (has.call(modules, path)) return initModule(path, modules[path]);

    throw new Error("Cannot find module '" + name + "' from '" + loaderPath + "'");
  };

  require.alias = function(from, to) {
    aliases[to] = from;
  };

  require.reset = function() {
    modules = {};
    cache = {};
    aliases = {};
  };

  var extRe = /\.[^.\/]+$/;
  var indexRe = /\/index(\.[^\/]+)?$/;
  var addExtensions = function(bundle) {
    if (extRe.test(bundle)) {
      var alias = bundle.replace(extRe, '');
      if (!has.call(aliases, alias) || aliases[alias].replace(extRe, '') === alias + '/index') {
        aliases[alias] = bundle;
      }
    }

    if (indexRe.test(bundle)) {
      var iAlias = bundle.replace(indexRe, '');
      if (!has.call(aliases, iAlias)) {
        aliases[iAlias] = bundle;
      }
    }
  };

  require.register = require.define = function(bundle, fn) {
    if (typeof bundle === 'object') {
      for (var key in bundle) {
        if (has.call(bundle, key)) {
          require.register(key, bundle[key]);
        }
      }
    } else {
      modules[bundle] = fn;
      delete cache[bundle];
      addExtensions(bundle);
    }
  };

  require.list = function() {
    var result = [];
    for (var item in modules) {
      if (has.call(modules, item)) {
        result.push(item);
      }
    }
    return result;
  };

  require.brunch = true;
  require._cache = cache;
  globals.require = require;
})();
var BUXCli, Path, defaultsDeep, fs, program;

program = require('commander');

fs = require('fs');

Path = require('path');

defaultsDeep = require('lodash.defaultsdeep');

BUXCli = (function() {
  BUXCli.prototype.commands = {
    login: {
      desc: 'Login to BUX account and create config'
    },
    find: {
      title: 'find [<pattern>]',
      aliases: ['f'],
      desc: 'Products list',
      options: [['-f, --favorite', 'Show favorite products'], ['-o, --only-open', 'Show open products'], ['--category [cat]', 'Filter by category'], ['--status [OPEN|CLOSED]', 'Filter by market status'], ['-s, --sort [column]', 'Sort table'], ['-c, --columns [columns]', 'Select columns to show'], ['-l, --list-columns', 'List available columns for sort or view']]
    },
    product: {
      title: 'product <product-id>',
      desc: 'Info about specified product',
      aliases: ['pro']
    },
    positions: {
      title: 'positions [<pattern>]',
      desc: 'Portfolio overview',
      aliases: ['p'],
      options: [['-s, --sort [column]', 'Sort table'], ['-c, --columns [columns]', 'Select columns to show'], ['-l, --list-columns', 'List available columns for sort or view'], ['-w, --watch', 'Refresh in specified interval'], ['-i, --interval [s]', 'Watch interval']]
    },
    position: {
      title: 'position <position-id>',
      desc: 'Info about specified position',
      aliases: ['pos']
    },
    open: {
      title: 'open <product-id> <direction> <trade-size> <leverage>',
      desc: 'Open position',
      aliases: ['o']
    },
    close: {
      title: 'close [<position-id>]',
      aliases: ['c'],
      desc: 'Close position'
    },
    fees: {
      title: 'fees',
      desc: 'Fees'
    },
    autoclose: {
      title: 'autoclose <position-id>',
      aliases: ['ac'],
      desc: 'Set autoclose values to position'
    },
    balance: {
      title: 'balance',
      desc: 'Account balance',
      aliases: ['b']
    },
    history: {
      title: 'history [<pattern>]',
      desc: 'Trade history',
      aliases: ['h'],
      options: [['-s, --sort [column]', 'Sort table']]
    },
    me: {
      title: 'me',
      desc: 'Info about you'
    },
    profile: {
      desc: 'Basic account info',
      aliases: ['pr']
    },
    friends: {
      title: 'friends [<pattern>]',
      aliases: ['fr'],
      desc: 'List your friends',
      options: [['-s, --sort [column]', 'Sort table'], ['-c, --columns [columns]', 'Select columns to show'], ['-l, --list-columns', 'List available columns for sort or view']]
    },
    exec: {
      title: 'exec <command> [<arguments>]',
      aliases: ['e'],
      desc: 'Execute raw libbux command'
    }
  };

  BUXCli.prototype.config = {};

  BUXCli.prototype.cmdProgram = null;

  BUXCli.prototype.loadedModules = {};

  BUXCli.prototype.userConfig = {
    aliases: {
      directions: {
        BUY: '+, up, buy',
        SELL: '-, down, sell'
      }
    },
    positions: {
      columns: 'short_id, product, product_ident, type, amount, leverage, trade_price, price, change, profit, age',
      sort: '!change'
    },
    friends: {
      columns: 'short_id, nickname, country, type, title, since',
      sort: 'nickname'
    },
    find: {
      columns: 'id, name, product_ident, category, max_leverage, status, price, change, favorite',
      sort: 'id'
    },
    history: {
      columns: 'short_id, type, product, product_ident, amount, leverage, price, profit, status, order_type, age',
      sort: '!created'
    }
  };

  function BUXCli() {
    this.version = JSON.parse(fs.readFileSync(Path.resolve(__dirname, '..', 'package.json'))).version;
    this.loadProgram((function(_this) {
      return function(cmd) {
        return _this.run(cmd);
      };
    })(this));
  }

  BUXCli.prototype.modules = function(arr, callback) {
    var i, len, mi, mod, output;
    output = [];
    for (i = 0, len = arr.length; i < len; i++) {
      mi = arr[i];
      if (this.loadedModules[mi]) {
        mod = this.loadedModules[mi];
      } else {
        mod = require(mi);
        this.loadedModules[mi] = mod;
      }
      output.push(mod);
    }
    return callback.apply(null, output);
  };

  BUXCli.prototype.getVersion = function() {
    return this.modules(['libbux'], (function(_this) {
      return function(BUX) {
        return _this.version + " (libbux " + BUX.version + ")";
      };
    })(this));
  };

  BUXCli.prototype.run = function(cmd) {
    this.debug("Running command: " + cmd);
    return this.modules(['libbux'], (function(_this) {
      return function(BUX) {
        var buxConfig, ref;
        buxConfig = {
          server: _this.program.server || _this.userConfig.server,
          access_token: (ref = _this.userConfig.account) != null ? ref.access_token : void 0,
          no_symbols: true
        };
        _this.userConfig.symbols = defaultsDeep(BUX.symbols, _this.userConfig.symbols);
        return BUX.api(buxConfig, function(bux) {
          _this.bux = bux;
          return _this['cmd_' + cmd](function(err, output) {
            if (err) {
              _this.exception(err);
            }
            if (!output) {
              _this.exception('endpoint not found');
            } else if (typeof output === 'string') {
              console.log(output);
            } else {
              if (_this.program.json) {
                console.log(JSON.stringify(output.json));
              } else if (output.text) {
                console.log(output.text);
              }
            }
            return _this.debug('Done.');
          });
        });
      };
    })(this));
  };

  BUXCli.prototype.exception = function(err) {
    console.log("Error: " + err);
    return process.exit(10);
  };

  BUXCli.prototype.loadProgram = function(callback) {
    var alias, aliases, args, cmd, cmdData, cmdKey, cmdProgram, i, len, pc, ref, ref1, title;
    this.program = program.usage('[options] <command>').version(this.getVersion()).option('-d, --debug', 'print verbose debug output to stdout').option('-j, --json', 'output in json').option('--server <address>', 'server api address');
    aliases = {};
    cmd = null;
    cmdProgram = null;
    ref = this.commands;
    for (cmdKey in ref) {
      cmdData = ref[cmdKey];
      title = cmdKey;
      if (cmdData.title) {
        title = cmdData.title;
      }
      pc = this.program.command(title).description(cmdData.desc);
      if (cmdData.aliases) {
        ref1 = cmdData.aliases;
        for (i = 0, len = ref1.length; i < len; i++) {
          alias = ref1[i];
          aliases[alias] = cmdKey;
        }
        cmdData.aliases.map(function(opt) {
          return pc = pc.alias(opt);
        });
      }
      if (cmdData.options) {
        cmdData.options.map(function(opt) {
          return pc = pc.option(opt[0], opt[1]);
        });
      }
      pc = pc.action(function() {
        var arg, j, len1, outArgs;
        program = arguments[Object.keys(arguments).length - 1];
        cmd = program._name;
        cmdProgram = program;
        outArgs = [];
        for (j = 0, len1 = arguments.length; j < len1; j++) {
          arg = arguments[j];
          if (typeof arg !== 'object') {
            outArgs.push(arg);
          }
        }
        return cmdProgram.parsedArgs = outArgs;
      });
    }
    args = process.argv.slice();
    if (aliases[args[2]]) {
      args[2] = aliases[args[2]];
    }
    this.program.parse(args);
    this.cmdProgram = cmdProgram;
    if (this.program.debug) {
      process.env.DEBUG = 'bux:*,libbux:*,superagent:*';
      this.debug = require('debug')('bux:main');
      this.debug('Debug mode enabled.');
    } else {
      this.debug = function() {
        return null;
      };
    }
    if (cmd === null) {
      this.program.outputHelp();
      return process.exit(0);
    } else if (!this['cmd_' + cmd]) {
      return this.exception("Command not exists: " + cmd);
    } else if (cmd === 'login') {
      return callback(cmd);
    } else {
      return this.loadUserConfig((function(_this) {
        return function() {
          return callback(cmd);
        };
      })(this));
    }
  };

  BUXCli.prototype.getPrompt = function(schema, callback) {
    var prompt;
    prompt = require('prompt');
    prompt.message = '';
    prompt.delimited = '';
    prompt.start();
    return prompt.get(schema, function(err, result) {
      prompt.stop();
      return callback(err, result);
    });
  };

  BUXCli.prototype.cmd_open = function(callback) {
    var args, query;
    args = this.cmdProgram.parsedArgs;
    query = {
      product: this.resolveProductId(args[0]),
      direction: this.resolveDirection(args[1]),
      size: args[2],
      multiplier: args[3]
    };
    if (!query.direction) {
      return callback("bad direction: " + args[1]);
    }
    if (new Number(query.size) <= 0) {
      return callback("bad size: " + query.size);
    }
    if (new Number(query.multiplier) <= 0) {
      return callback("bad multiplier: " + query.multiplier);
    }
    return this.bux.open(query, (function(_this) {
      return function(err, output) {
        var created, productId, text;
        if (err) {
          return _this.exception(err);
        }
        productId = _this.getSymbol(output.product.securityId) || output.product.securityId;
        created = new Date(new Number(output.dateCreated)).toString();
        text = "Position successfully opened!\n" + ("  Trade Id: " + output.id + "\n") + ("  Type: " + output.type + "\n") + ("  Position Id: " + output.positionId + "\n") + ("  Product: " + output.product.displayName + " [" + productId + "]\n") + ("  Direction: " + output.direction + "\n") + ("  Trade size: " + output.investingAmount.amount + "\n") + ("  Multiplier: " + output.leverage + "\n") + ("  Current price: " + output.price.amount + "\n") + ("  Time: " + created);
        return callback(null, {
          text: text,
          json: output
        });
      };
    })(this));
  };

  BUXCli.prototype.cmd_close = function(callback) {
    var args, positionId;
    args = this.cmdProgram.parsedArgs;
    positionId = args[0];
    if (!positionId) {
      return callback('no position id');
    }
    return this.bux.close(positionId, (function(_this) {
      return function(err, output) {
        var created, productId, text;
        if (err) {
          return callback(err);
        }
        productId = _this.getSymbol(output.product.securityId) || output.product.securityId;
        created = new Date(new Number(output.dateCreated)).toString();
        text = "Position closed!\n" + ("  Trade Id: " + output.id + "\n") + ("  Type: " + output.type + "\n") + ("  Position Id: " + output.positionId + "\n") + ("  Product: " + output.product.displayName + " [" + productId + "]\n") + ("  Direction: " + output.direction + "\n") + ("  Trade size: " + output.investingAmount.amount + "\n") + ("  Multiplier: " + output.leverage + "\n") + ("  Close price: " + output.price.amount + "\n") + ("  Profit: " + output.profitAndLoss.amount + " " + output.profitAndLoss.currency + "\n") + ("  Time: " + created);
        return callback(null, {
          text: text,
          json: output
        });
      };
    })(this));
  };

  BUXCli.prototype.cmd_me = function(callback) {
    return this.bux.me((function(_this) {
      return function(err, data) {
        if (err) {
          return _this.exception(err);
        }
        return callback(null, {
          text: JSON.stringify(data, null, 2),
          json: data
        });
      };
    })(this));
  };

  BUXCli.prototype.cmd_help = function(callback) {
    program.outputHelp();
    return callback(null, null);
  };

  BUXCli.prototype.cmd_login = function(callback) {
    var schema;
    console.log("Welcome to BUX terminal interface!");
    console.log('Please specify your account details');
    schema = {
      properties: {
        email: {
          description: 'Email'
        },
        password: {
          description: 'Password',
          hidden: true
        }
      }
    };
    return this.getPrompt(schema, (function(_this) {
      return function(err, account) {
        _this.debug("Logging to BUX [email=" + account.email + "] ..");
        return _this.bux.login(account, function(err, data) {
          if (err || !data.access_token) {
            return _this.exception('Login error');
          }
          _this.debug("Login done. Saving ..");
          return _this.saveUserConfig('account', {
            access_token: data.access_token
          }, function() {
            return callback(null, {
              text: 'Login done! Welcome abroad.',
              json: data
            });
          });
        });
      };
    })(this));
  };

  BUXCli.prototype.cmd_history = function(callback) {
    var columns, data, finishView, table;
    columns = {
      id: {
        name: 'Id',
        key: 'id'
      },
      short_id: {
        name: 'Trade Id',
        render: function(x) {
          return x.id.substring(0, 8);
        }
      },
      category: {
        name: 'Category',
        key: 'product.category'
      },
      product: {
        name: 'Product',
        key: 'product.displayName'
      },
      product_id: {
        name: 'Product Id',
        key: 'product.securityId'
      },
      product_ident: {
        name: 'Product Id',
        render: (function(_this) {
          return function(x) {
            return _this.resolveProductSymbol(x.product.securityId);
          };
        })(this)
      },
      type: {
        name: 'Type',
        key: 'direction'
      },
      status: {
        name: 'Status',
        key: 'type'
      },
      leverage: {
        name: '× M',
        key: 'leverage'
      },
      price: {
        name: 'Trade price',
        key: 'price.amount',
        align: 'RIGHT'
      },
      amount: {
        name: 'Amount',
        key: 'investingAmount.amount',
        align: 'RIGHT'
      },
      change: {
        name: 'Change',
        align: 'RIGHT',
        sortRank: function(x) {
          return x.rendered.change.replace(/[\+]+/, '');
        },
        render: (function(_this) {
          return function(x) {
            return '';
          };
        })(this)
      },
      created: {
        name: 'Created',
        key: 'dateCreated'
      },
      age: {
        name: 'Age',
        sortRank: function(x) {
          return x.pos.dateCreated;
        },
        render: function(x) {
          return require('moment')(x.dateCreated).fromNow(true).toString();
        }
      },
      profit: {
        name: 'Profit',
        align: 'RIGHT',
        render: function(x) {
          var ref;
          return ((ref = x.profitAndLoss) != null ? ref.amount : void 0) || '';
        }
      },
      order_type: {
        name: 'Status type',
        key: 'orderType'
      }
    };
    table = this.createTable(columns, 'History', 'product');
    if (this.cmdProgram.listColumns) {
      data = table.listColumns();
      return callback(null, {
        text: data.table.toString(),
        json: data.columns
      });
    }
    if (typeof this.program.args[0] === "string") {
      table.setSearch(this.program.args[0]);
    }
    table.setLayout(this.cmdProgram.columns || this.userConfig.history.columns);
    table.setSort(this.cmdProgram.sort || this.userConfig.history.sort);
    finishView = (function(_this) {
      return function(table, data) {
        table.titleFn = _this.createTitleFn("History");
        return table.render(data);
      };
    })(this);
    return this.bux.trades((function(_this) {
      return function(err, x) {
        var text;
        if (err) {
          return _this.exception(err);
        }
        text = finishView(table, x);
        return callback(null, {
          text: text,
          json: x
        });
      };
    })(this));
  };

  BUXCli.prototype.cmd_positions = function(callback) {
    var columns, data, finishView, interval, renderView, table, term;
    columns = {
      id: {
        name: 'Id',
        key: 'id'
      },
      short_id: {
        name: 'Trade Id',
        render: function(x) {
          return x.id.substring(0, 8);
        }
      },
      category: {
        name: 'Category',
        key: 'product.category'
      },
      product: {
        name: 'Product',
        key: 'product.displayName'
      },
      product_id: {
        name: 'Product Id',
        key: 'product.securityId'
      },
      product_ident: {
        name: 'Product Id',
        render: (function(_this) {
          return function(x) {
            return _this.resolveProductSymbol(x.product.securityId);
          };
        })(this)
      },
      leverage: {
        name: '× M',
        key: 'leverage'
      },
      type: {
        name: 'Type',
        key: 'type'
      },
      trade_price: {
        name: 'Trade price',
        key: 'tradePrice.amount',
        align: 'RIGHT'
      },
      price: {
        name: 'Price',
        key: 'currentPrice.amount',
        align: 'RIGHT'
      },
      profit: {
        name: 'Profit',
        align: 'RIGHT',
        render: function(x) {
          var ref;
          return ((ref = x.profitAndLoss) != null ? ref.amount : void 0) || '';
        }
      },
      amount: {
        name: 'Amount',
        key: 'investedAmount.amount',
        align: 'RIGHT'
      },
      opened: {
        name: 'Opened',
        key: 'openingsDate'
      },
      age: {
        name: 'Age',
        sortRank: function(x) {
          return x.pos.openingsDate;
        },
        render: function(x) {
          return require('moment')(x.openingsDate).fromNow(true).toString();
        }
      },
      change: {
        name: 'Change',
        align: 'RIGHT',
        sortRank: function(x) {
          return x.rendered.change.replace(/[\+]+/, '');
        },
        render: (function(_this) {
          return function(x) {
            return _this.calcDiff(x.currentPrice.amount, x.tradePrice.amount, x.leverage, x.type);
          };
        })(this)
      }
    };
    table = this.createTable(columns, 'positions', 'product');
    if (this.cmdProgram.listColumns) {
      data = table.listColumns();
      return callback(null, {
        text: data.table.toString(),
        json: data.columns
      });
    }
    if (typeof this.program.args[0] === "string") {
      table.setSearch(this.program.args[0]);
    }
    table.setLayout(this.cmdProgram.columns || this.userConfig.positions.columns);
    table.setSort(this.cmdProgram.sort || this.userConfig.positions.sort);
    finishView = (function(_this) {
      return function(table, data) {
        table.titleFn = _this.createTitleFn("Positions");
        return table.render(data);
      };
    })(this);
    if (this.cmdProgram.watch) {
      interval = this.cmdProgram.interval;
      if (!interval) {
        interval = 10;
      }
      term = require('terminal-kit').terminal;
      term.fullscreen({
        noAlternate: true
      });
      renderView = (function(_this) {
        return function() {
          return _this.bux.portfolio(function(err, x) {
            if (err) {
              return _this.exception(err);
            }
            term.clear();
            term(finishView(table, x.positions));
            return term("\nLast updated: " + (new Date));
          });
        };
      })(this);
      renderView();
      return setInterval(renderView, interval * 1000);
    } else {
      return this.bux.portfolio((function(_this) {
        return function(err, x) {
          var text;
          if (err) {
            return _this.exception(err);
          }
          text = finishView(table, x.positions);
          return callback(null, {
            text: text,
            json: x.positions
          });
        };
      })(this));
    }
  };

  BUXCli.prototype.getSymbol = function(productId, showAll) {
    var str;
    if (showAll == null) {
      showAll = false;
    }
    if (this.userConfig.symbols[productId]) {
      str = '@' + this.userConfig.symbols[productId];
      if (!showAll) {
        return str.split('/')[0];
      }
      return str;
    }
    return null;
  };

  BUXCli.prototype.resolveDirection = function(dir) {
    var d, da, dk, i, len, ref, ref1;
    if (this.userConfig.aliases.directions != null) {
      ref = this.userConfig.aliases.directions;
      for (dk in ref) {
        da = ref[dk];
        ref1 = da.split(',').map(function(x) {
          return x.trim();
        });
        for (i = 0, len = ref1.length; i < len; i++) {
          d = ref1[i];
          if (d === dir) {
            dir = dk;
          }
          continue;
        }
      }
    }
    if (dir !== 'SELL' && dir !== 'BUY') {
      return false;
    }
    return dir;
  };

  BUXCli.prototype.resolveProductSymbol = function(id) {
    var symbol;
    symbol = this.bux.findSymbolByProduct(id);
    if (!symbol) {
      return id;
    }
    return "@" + symbol;
  };

  BUXCli.prototype.resolveProductId = function(id) {
    var symbol;
    symbol = this.bux.findProductBySymbol(id, this.userConfig.symbols);
    return symbol || id;
  };

  BUXCli.prototype.cmd_position = function(callback) {
    var positionId;
    positionId = this.cmdProgram.parsedArgs[0];
    this.debug("Getting position: " + positionId);
    return this.bux.position(positionId, (function(_this) {
      return function(err, pos) {
        return callback(err, {
          text: JSON.stringify(pos, null, 2),
          json: pos
        });
      };
    })(this));
  };

  BUXCli.prototype.cmd_fees = function(callback) {
    return this.bux.fees((function(_this) {
      return function(err, fees) {
        return callback(null, {
          text: JSON.stringify(fees, null, 2),
          json: fees
        });
      };
    })(this));
  };

  BUXCli.prototype.cmd_product = function(callback) {
    var params, productId, table;
    productId = this.resolveProductId(this.cmdProgram.parsedArgs[0]);
    this.debug("Getting product: " + productId);
    params = {
      securityId: {
        name: 'Id'
      },
      displayName: {
        name: 'Name'
      },
      favorite: {
        name: 'Favorite'
      },
      category: {
        name: 'Category'
      },
      maxLeverage: {
        name: 'Max multiplier'
      },
      description: {
        name: 'Description'
      }
    };
    table = this.createTableSimple(params, "Product", 'key');
    return this.bux.product(productId, (function(_this) {
      return function(err, product) {
        var matrix;
        if (err) {
          return _this.exception(err);
        }
        if (!product) {
          return _this.exception("Product not found: " + productId);
        }
        matrix = table.processSimpleData(product, params);
        return callback(null, {
          text: table.render(matrix),
          json: product
        });
      };
    })(this));
  };

  BUXCli.prototype.cmd_profile = function(callback) {
    var params, table;
    params = {
      id: {
        name: 'Id'
      },
      nickname: {
        name: 'Nickname'
      },
      avatarUrl: {
        name: 'Avatar URL'
      },
      countryCode: {
        name: 'Country'
      },
      title: {
        name: 'Title'
      },
      tradingStats: {
        name: 'Trading Stats'
      },
      accountType: {
        name: 'Account Type'
      },
      level: {
        name: 'Level'
      }
    };
    table = this.createTableSimple(params, "Profile [" + this.userConfig.account.username + "]", 'key');
    return this.bux.profile((function(_this) {
      return function(err, x) {
        var matrix;
        if (err) {
          return _this.exception(err);
        }
        matrix = table.processSimpleData(x, params);
        return callback(null, {
          text: table.render(matrix),
          json: x
        });
      };
    })(this));
  };

  BUXCli.prototype.cmd_find = function(callback) {
    var columns, data, table;
    columns = {
      id: {
        key: 'securityId',
        name: 'Id'
      },
      name: {
        name: 'Name',
        key: 'displayName'
      },
      max_leverage: {
        name: 'Max ×',
        key: 'maxLeverage'
      },
      category: {
        name: 'Category',
        key: 'category'
      },
      favorite: {
        name: 'Favorite',
        key: 'favorite'
      },
      status: {
        name: 'Status',
        key: 'productMarketStatus'
      },
      price: {
        name: 'Price',
        key: 'currentPrice.amount'
      },
      change: {
        name: 'Change',
        align: 'RIGHT',
        sortRank: function(x) {
          return x.rendered.change.replace(/[\+]+/, '');
        },
        render: (function(_this) {
          return function(x) {
            return _this.calcDiff(x.closingPrice.amount, x.currentPrice.amount, 1);
          };
        })(this)
      },
      product_ident: {
        name: 'Product Id',
        render: (function(_this) {
          return function(x) {
            return _this.resolveProductSymbol(x.securityId);
          };
        })(this)
      },
      symbol: {
        name: 'Symbol',
        render: (function(_this) {
          return function(x) {
            return _this.getSymbol(x.securityId);
          };
        })(this)
      },
      symbols: {
        name: 'Symbols',
        render: (function(_this) {
          return function(x) {
            return _this.getSymbol(x.securityId, true);
          };
        })(this)
      }
    };
    table = this.createTable(columns, null, 'name');
    if (this.cmdProgram.listColumns) {
      data = table.listColumns();
      return callback(null, {
        text: data.table.toString(),
        json: data.columns
      });
    }
    return this.bux.products((function(_this) {
      return function(err, x) {
        if (err) {
          return _this.exception(err);
        }
        if (typeof _this.program.args[0] === "string") {
          table.setSearch(_this.program.args[0]);
        }
        table.filterFn = function(item) {
          var status;
          status = true;
          if (_this.cmdProgram.favorite) {
            status = (item.favorite ? true : false);
          }
          if (status && _this.cmdProgram.status) {
            status = item.productMarketStatus === _this.cmdProgram.status;
          } else if (status && _this.cmdProgram.onlyOpen) {
            status = item.productMarketStatus === 'OPEN';
          }
          return status;
        };
        table.titleFn = _this.createTitleFn("Products");
        table.setLayout(_this.cmdProgram.columns || _this.userConfig.find.columns);
        table.setSort(_this.cmdProgram.sort || _this.userConfig.find.sort);
        return callback(null, {
          text: table.render(x),
          json: x
        });
      };
    })(this));
  };

  BUXCli.prototype.cmd_exec = function(callback, args) {
    var cmd;
    args = this.program.args.map(function(x) {
      return (typeof x === 'string' && x !== '' ? x : false);
    });
    args = args.filter(function(x) {
      return x !== false;
    });
    args.push(function(err, data) {
      return callback(null, {
        text: JSON.stringify(data, null, 2),
        json: data
      });
    });
    cmd = args.shift();
    if (!this.bux[cmd]) {
      return callback(null, 'Bad command: ' + cmd);
    }
    return this.bux[cmd].apply(this.bux, args);
  };

  BUXCli.prototype.cmd_friends = function(callback) {
    var columns, data, table;
    columns = {
      id: {
        key: 'id',
        name: 'Id'
      },
      short_id: {
        name: 'Id',
        render: function(x) {
          return x.id.substring(0, 8);
        }
      },
      nickname: {
        key: 'nickname',
        name: 'Nickname'
      },
      title: {
        key: 'title',
        name: 'Title'
      },
      country: {
        key: 'countryCode',
        name: 'Country'
      },
      type: {
        key: 'accountType',
        name: 'Account type'
      },
      since: {
        name: 'Friend since',
        render: function(x) {
          return require('moment')(x.friendSince).fromNow(true).toString();
        }
      },
      since_time: {
        name: 'Friend since (date)',
        key: 'friendSince'
      }
    };
    table = this.createTable(columns, null, 'nickname');
    if (this.cmdProgram.listColumns) {
      data = table.listColumns();
      return callback(null, {
        text: data.table.toString(),
        json: data.columns
      });
    }
    return this.bux.friends((function(_this) {
      return function(err, x) {
        if (err) {
          return _this.exception(err);
        }
        if (typeof _this.program.args[0] === "string") {
          table.setSearch(_this.program.args[0]);
        }
        table.titleFn = _this.createTitleFn("Friends");
        table.setLayout(_this.cmdProgram.columns || _this.userConfig.friends.columns);
        table.setSort(_this.cmdProgram.sort || _this.userConfig.friends.sort);
        return callback(null, {
          text: table.render(x),
          json: x
        });
      };
    })(this));
  };

  BUXCli.prototype.verifyProduct = function(productId) {};

  BUXCli.prototype.createTable = function(columns, name, defaultColumn) {
    var Table, table;
    Table = require('./table');
    table = new Table(columns, defaultColumn, name);
    return table;
  };

  BUXCli.prototype.createTableSimple = function(params, name, defaultColumn) {
    var columns, table;
    columns = {
      param: {
        key: 'key',
        name: 'Key',
        align: 'RIGHT'
      },
      value: {
        key: 'value',
        name: 'Value'
      }
    };
    table = this.createTable(columns, name, defaultColumn);
    table.showHeader = false;
    table.setLayout('param,value');
    if (typeof this.program.args[0] === "string") {
      table.setSearch(this.program.args[0]);
    }
    return table;
  };

  BUXCli.prototype.createTitleFn = function(title) {
    return (function(_this) {
      return function(counter, product) {
        return title + " (" + counter + ") [" + _this.userConfig.account.username + "]";
      };
    })(this);
  };

  BUXCli.prototype.getConfigFilename = function() {
    return Path.join(process.env.HOME, '.bux-config.json');
  };

  BUXCli.prototype.saveUserConfig = function(key, val, callback) {
    var fn, output;
    this.debug("Saving config: key=" + key + " value=" + val);
    fn = this.getConfigFilename();
    if (fs.existsSync(fn)) {
      output = JSON.parse(fs.readFileSync(fn));
    } else {
      output = {};
    }
    output[key] = val;
    return fs.writeFile(fn, JSON.stringify(output, null, 2), (function(_this) {
      return function() {
        _this.debug("Config saved: " + fn);
        return callback();
      };
    })(this));
  };

  BUXCli.prototype.loadUserConfig = function(callback) {
    var config, fn;
    fn = this.getConfigFilename();
    this.debug("Loading config from " + fn + " ..");
    if (!fs.existsSync(fn)) {
      this.exception("Config file " + fn + " not exists.\nPlease use `bux login` to create a new one.");
    }
    config = JSON.parse(fs.readFileSync(fn));
    this.userConfig = defaultsDeep(config, this.userConfig);
    this.debug("Config loaded: " + (JSON.stringify(this.userConfig, null, 2)));
    return callback();
  };

  BUXCli.prototype.calcDiff = function(current, traded, leverage, type) {
    var diff, numb;
    if (leverage == null) {
      leverage = 1;
    }
    if (type == null) {
      type = "SHORT";
    }
    diff = current - traded;
    numb = new Number((diff / (traded / 100)) * leverage).toFixed(2);
    if (type === 'SHORT') {
      numb = new Number(-numb).toFixed(2);
    }
    if (numb > 0) {
      numb = "+" + numb;
    }
    return numb + '%';
  };

  return BUXCli;

})();

module.exports = {
  version: BUXCli.version,
  run: function() {
    return new BUXCli;
  }
};
;
//# sourceMappingURL=cli.js.map