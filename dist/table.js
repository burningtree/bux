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
var AsciiTable, Table,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

AsciiTable = require('ascii-table');

Table = (function() {
  Table.prototype.sort = 'id';

  Table.prototype.search = false;

  Table.prototype.showHeader = true;

  Table.prototype.defaultColumn = 'id';

  Table.prototype.name = null;

  Table.prototype.title = null;

  Table.prototype.stats = {
    total: 0,
    show: 0
  };

  function Table(columns, defaultColumn, name, sort1) {
    this.columns = columns;
    this.defaultColumn = defaultColumn;
    this.name = name;
    this.sort = sort1;
    this.processSimpleData = bind(this.processSimpleData, this);
    this.debug = require('debug')('bux:table');
    return true;
  }

  Table.prototype.render = function(array) {
    var c, col, cols, heading, i, j, l, len, len1, len2, len3, len4, len5, m, n, o, p, pos, ref, ref1, ref2, ref3, ref4, rendered, row, rows, searchExpr, sortBy, spl, table, val, valid;
    heading = [];
    rows = [];
    ref = this.layout;
    for (j = 0, len = ref.length; j < len; j++) {
      col = ref[j];
      if (!this.columns[col]) {
        continue;
      }
      heading.push(this.columns[col].name);
    }
    if (this.search) {
      if (this.search.substring(0, 1) === '@') {
        searchExpr = new RegExp('^' + this.search + '$', 'i');
      } else {
        searchExpr = new RegExp(this.search, 'i');
      }
      this.debug("Search expression: " + searchExpr);
    }
    this.stats.total = 0;
    this.stats.show = 0;
    for (l = 0, len1 = array.length; l < len1; l++) {
      pos = array[l];
      valid = true;
      this.stats.total++;
      if (this.filterFn) {
        if (!this.filterFn(pos)) {
          continue;
        }
      }
      cols = [];
      rendered = {};
      ref1 = this.layout;
      for (m = 0, len2 = ref1.length; m < len2; m++) {
        col = ref1[m];
        if (!this.columns[col]) {
          return "Column not found: " + col;
        }
        if (this.columns[col].render) {
          val = this.columns[col].render(pos);
        } else if (this.columns[col].key.match(/\./)) {
          spl = this.columns[col].key.split('.');
          val = (ref2 = pos[spl[0]]) != null ? ref2[spl[1]] : void 0;
        } else {
          val = pos[this.columns[col].key];
        }
        if (this.search && col === this.defaultColumn) {
          if (!val.match(searchExpr)) {
            valid = false;
          }
        }
        cols.push(val);
        rendered[col] = val;
      }
      if (this.search) {
        ref3 = [rendered.id, rendered.symbols, rendered.product_ident];
        for (n = 0, len3 = ref3.length; n < len3; n++) {
          c = ref3[n];
          if (!valid && c) {
            valid = c.match(searchExpr) ? true : false;
          }
        }
      }
      if (valid === true) {
        rows.push({
          cols: cols,
          pos: pos,
          rendered: rendered
        });
        this.stats.show++;
      }
    }
    if (this.titleFn) {
      this.title = this.titleFn('' + this.stats.show + '/' + this.stats.total);
    }
    table = new AsciiTable(this.title || this.name);
    if (this.showHeader && heading.length > 0) {
      table.setHeading(heading);
    }
    ref4 = this.layout;
    for (i = o = 0, len4 = ref4.length; o < len4; i = ++o) {
      col = ref4[i];
      if (!this.columns[col]) {
        return this.exception("Bad portfolio column: " + col);
      }
      if (this.columns[col].align) {
        table = table.setAlign(i, AsciiTable[this.columns[col].align]);
      }
    }
    if (this.sort) {
      this.debug("Sort key: " + this.sort);
      sortBy = {
        key: this.sort.match(/^(\!|)(.+)/)[2],
        direction: this.sort.match(/^\!/) ? -1 : 1
      };
      rows.sort((function(_this) {
        return function(xa, xb) {
          var a, b, compare, isNumber, rank;
          a = xa.cols;
          b = xb.cols;
          isNumber = false;
          rank = function(v) {
            var index, numb;
            index = Object.keys(_this.layout).indexOf(sortBy.key);
            if (_this.columns[sortBy.key].sortRank) {
              val = _this.columns[sortBy.key].sortRank(v);
            } else if (index === -1) {
              val = v.pos[_this.columns[sortBy.key].key];
            } else {
              val = v.cols[index];
            }
            if (val === void 0) {
              val = 0;
            }
            numb = val.toString().match(/([\d\.\-]*)/);
            if (numb) {
              isNumber = true;
              return new Number(numb[1]);
            } else {
              return val.toString().substring(0, 1);
            }
          };
          compare = function(x, y) {
            return rank(x) - rank(y);
          };
          if (sortBy.direction === -1) {
            return compare(xb, xa);
          } else {
            return compare(xa, xb);
          }
        };
      })(this));
    }
    for (p = 0, len5 = rows.length; p < len5; p++) {
      row = rows[p];
      table.addRow(row.cols);
    }
    return table.toString();
  };

  Table.prototype.setSort = function(sort) {
    return this.sort = sort.trim();
  };

  Table.prototype.setLayout = function(layout) {
    return this.layout = layout.split(',').map(function(val) {
      return val.trim();
    });
  };

  Table.prototype.setSearch = function(q) {
    return this.search = q;
  };

  Table.prototype.setTitle = function(str) {
    return this.title = str;
  };

  Table.prototype.processSimpleData = function(x, params) {
    var ignore, k, matrix, v;
    ignore = ['avatarUrl'];
    matrix = [];
    for (k in x) {
      v = x[k];
      if (indexOf.call(ignore, k) >= 0) {
        continue;
      }
      if (typeof v === 'object' && v !== null) {
        v = JSON.stringify(v).substring(0, 10) + ' ..';
      }
      if (!params[k]) {
        continue;
      }
      matrix.push({
        key: params[k].name,
        value: v.toString()
      });
    }
    return matrix;
  };

  Table.prototype.listColumns = function() {
    var col, colKey, columnsOutput, lines, ref, table;
    columnsOutput = [];
    lines = [];
    ref = this.columns;
    for (colKey in ref) {
      col = ref[colKey];
      columnsOutput.push({
        key: colKey,
        name: col.name
      });
      lines.push([colKey, col.name]);
    }
    table = new AsciiTable('Available columns').setHeading(['Column', 'Name']);
    table.addRowMatrix(lines);
    return {
      table: table,
      columns: columnsOutput
    };
  };

  return Table;

})();

module.exports = Table;
;
//# sourceMappingURL=table.js.map