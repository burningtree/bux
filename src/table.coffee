AsciiTable = require 'ascii-table'

class Table

  sort: 'id'
  search: false
  showHeader: true
  defaultColumn: 'id'
  name: null
  title: null
  stats:
    total: 0
    show: 0

  constructor: (@columns, @defaultColumn, @name, @sort) ->
    @debug = require('debug')('bux:table')
    return true

  render: (array) ->
    heading = []
    rows = []

    for col in @layout
      if not @columns[col]
        continue
      heading.push @columns[col].name

    if @search
      if @search.substring(0,1) == '@'
        searchExpr = new RegExp('^'+@search+'$', 'i')
      else
        searchExpr = new RegExp(@search, 'i')
      @debug "Search expression: #{searchExpr}"

    # traverse all items
    @stats.total = 0
    @stats.show = 0
    for pos in array
      valid = true
      @stats.total++

      if @filterFn
        if !@filterFn(pos) then continue

      cols = []
      rendered = {}
      for col in @layout
        if !@columns[col]
          return "Column not found: #{col}"

        if @columns[col].render
          val = @columns[col].render(pos)
        else if @columns[col].key.match(/\./)
          spl = @columns[col].key.split('.')
          val = pos[spl[0]]?[spl[1]]
        else
          val = pos[@columns[col].key]

        if @search and col == @defaultColumn
          if !val.match(searchExpr)
            valid = false

        cols.push val
        rendered[col] = val

      if @search
        for c in [ rendered.id, rendered.symbols, rendered.product_ident ]
          if !valid and c
            valid = if c.match(searchExpr) then true else false

      if valid == true
        rows.push { cols: cols, pos: pos, rendered: rendered }
        @stats.show++

    if @titleFn
      @title = @titleFn ''+@stats.show+'/'+@stats.total

    table = new AsciiTable(@title || @name)

    if @showHeader and heading.length > 0
      table.setHeading heading

    for col, i in @layout
      if !@columns[col]
        return @exception "Bad portfolio column: #{col}"
      if @columns[col].align
        table = table.setAlign i, AsciiTable[@columns[col].align]

    if @sort
      @debug "Sort key: #{@sort}"

      sortBy =
        key: @sort.match(/^(\!|)(.+)/)[2]
        direction: if @sort.match(/^\!/) then -1 else 1

      rows.sort (xa, xb) =>
        a = xa.cols
        b = xb.cols
        isNumber = false

        rank = (v) =>
          index = Object.keys(@layout).indexOf(sortBy.key)
          if @columns[sortBy.key].sortRank
            val = @columns[sortBy.key].sortRank(v)
          else if index == -1
            val = v.pos[@columns[sortBy.key].key]
          else
            val = v.cols[index]

          if val == undefined
            val = 0
          numb = val.toString().match(/([\d\.\-]*)/)
          if numb
            isNumber = true
            return new Number(numb[1])
          else
            return val.toString().substring(0,1)

        compare = (x, y) ->
          return rank(x) - rank(y)

        if sortBy.direction == -1
          return compare(xb, xa)
        else
          return compare(xa, xb)

    for row in rows
      table.addRow row.cols

    return table.toString()

  setSort: (sort) ->
    @sort = sort.trim()

  setLayout: (layout) ->
    @layout = layout.split(',').map (val) -> return val.trim()

  setSearch: (q) ->
    @search = q

  setTitle: (str) ->
    @title = str

  processSimpleData: (x, params) =>
    ignore = [ 'avatarUrl' ]

    matrix = []
    for k,v of x
      if k in ignore then continue
      if typeof(v) == 'object' and v != null
        v = JSON.stringify(v).substring(0,10) + ' ..'
      if !params[k] then continue

      matrix.push { key: params[k].name, value: v.toString() }

    return matrix

  listColumns: () ->
    columnsOutput = []
    lines = []

    for colKey, col of @columns
      columnsOutput.push { key: colKey, name: col.name }
      lines.push [ colKey, col.name ]

    table = new AsciiTable('Available columns')
      .setHeading [ 'Column', 'Name' ]

    table.addRowMatrix lines
    return { table: table, columns: columnsOutput }

module.exports = Table
