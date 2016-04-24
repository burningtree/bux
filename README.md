# bux

Let's rock the world of finance.. from your terminal!

This is an application with which you can control your [BUX](https://getbux.com) trading account using the command line. You can view your positions and products, as well as open new positions, etc.

Based on the [libBUX](https://github.com/burningtree/libbux) library.

**Warning: This application is in early development, therefore is buggy and unstable. Please use your FunBUX accounts for experimenting.**

## Install
If you have [Node.js](https://nodejs.org/en/):
```
$ npm install -g bux
```

## First steps

### Login
At first, you need to log in to your BUX account:
```
$ bux login
```
if you are not a BUX user, you can register through its mobile applications: [Android](https://play.google.com/store/apps/details?id=com.getbux.android&hl=en), [iOS](https://itunes.apple.com/gb/app/bux-casual-stock-trading/id892809783)

### Explore
For a list of all available commands:
```
$ bux help
```


## Usage
```
  Usage: bux [options] <command>


  Commands:

    login                                                    Login to BUX account and create config
    find|f [options] [<pattern>]                             Products list
    product|pro <product-id>                                 Info about specified product
    positions|p [options] [<pattern>]                        Portfolio overview
    position|pos <position-id>                               Info about specified position
    open|o <product-id> <direction> <trade-size> <leverage>  Open position
    close|c [<position-id>]                                  Close position
    fees                                                     Fees
    autoclose|ac <position-id>                               Set autoclose values to position
    balance|b                                                Account balance
    history|h [options] [<pattern>]                          Trade history
    me                                                       Info about you
    profile|pr                                               Basic account info
    friends|fr [options] [<pattern>]                         List your friends

  Options:

    -h, --help          output usage information
    -V, --version       output the version number
    -d, --debug         print verbose debug output to stdout
    -j, --json          output in json
    --server <address>  server api address


```

