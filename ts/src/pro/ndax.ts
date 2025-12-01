
//  ---------------------------------------------------------------------------

import ndaxRest from '../ndax.js';
import { ExchangeError, AuthenticationError } from '../base/errors.js';
import { ArrayCache } from '../base/ws/Cache.js';
import { sha256 } from '../static_dependencies/noble-hashes/sha256.js';
import type { Int, OrderBook, Trade, Ticker, OHLCV, Balances, Order, Dict } from '../base/types.js';
import Client from '../base/ws/Client.js';

//  ---------------------------------------------------------------------------

export default class ndax extends ndaxRest {
    describe (): any {
        return this.deepExtend (super.describe (), {
            'has': {
                'ws': true,
                'watchBalance': true,
                'watchMyTrades': true,
                'watchOrderBook': true,
                'watchOrders': true,
                'watchTrades': true,
                'watchTradesForSymbols': false,
                'watchTicker': true,
                'watchOHLCV': true,
            },
            'urls': {
                'test': {
                    'ws': 'wss://ndaxmarginstaging.cdnhop.net:10456/WSAdminGatewa/',
                },
                'api': {
                    'ws': 'wss://api.ndax.io/WSGateway',
                },
            },
            // 'options': {
            //     'tradesLimit': 1000,
            //     'ordersLimit': 1000,
            //     'OHLCVLimit': 1000,
            // },
            'streaming': {
                'ping': this.ping,
            },
        });
    }

    requestId () {
        const requestId = this.sum (this.safeInteger (this.options, 'requestId', 0), 1);
        this.options['requestId'] = requestId;
        return requestId;
    }

    /**
     * @method
     * @name ndax#watchTicker
     * @description watches a price ticker, a statistical calculation with the information calculated over the past 24 hours for a specific market
     * @see https://apidoc.ndax.io/#subscribelevel1
     * @param {string} symbol unified symbol of the market to fetch the ticker for
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} a [ticker structure]{@link https://docs.ccxt.com/#/?id=ticker-structure}
     */
    async watchTicker (symbol: string, params = {}): Promise<Ticker> {
        const omsId = this.safeInteger (this.options, 'omsId', 1);
        await this.loadMarkets ();
        const market = this.market (symbol);
        const name = 'SubscribeLevel1';
        const messageHash = name + ':' + market['id'];
        const url = this.urls['api']['ws'];
        const requestId = this.requestId ();
        const payload: Dict = {
            'OMSId': omsId,
            'InstrumentId': parseInt (market['id']), // conditionally optional
            // 'Symbol': market['info']['symbol'], // conditionally optional
        };
        const request: Dict = {
            'm': 0, // message type, 0 request, 1 reply, 2 subscribe, 3 event, unsubscribe, 5 error
            'i': requestId, // sequence number identifies an individual request or request-and-response pair, to your application
            'n': name, // function name is the name of the function being called or that the server is responding to, the server echoes your call
            'o': this.json (payload), // JSON-formatted string containing the data being sent with the message
        };
        const message = this.extend (request, params);
        return await this.watch (url, messageHash, message, messageHash);
    }

    handleTicker (client: Client, message) {
        const payload = this.safeValue (message, 'o', {});
        //
        //     {
        //         "OMSId": 1,
        //         "InstrumentId": 1,
        //         "BestBid": 6423.57,
        //         "BestOffer": 6436.53,
        //         "LastTradedPx": 6423.57,
        //         "LastTradedQty": 0.96183964,
        //         "LastTradeTime": 1534862990343,
        //         "SessionOpen": 6249.64,
        //         "SessionHigh": 11111,
        //         "SessionLow": 4433,
        //         "SessionClose": 6249.64,
        //         "Volume": 0.96183964,
        //         "CurrentDayVolume": 3516.31668185,
        //         "CurrentDayNumTrades": 8529,
        //         "CurrentDayPxChange": 173.93,
        //         "CurrentNotional": 0.0,
        //         "Rolling24HrNotional": 0.0,
        //         "Rolling24HrVolume": 4319.63870783,
        //         "Rolling24NumTrades": 10585,
        //         "Rolling24HrPxChange": -0.4165607307408487,
        //         "TimeStamp": "1534862990358"
        //     }
        //
        const ticker = this.parseTicker (payload);
        const symbol = ticker['symbol'];
        const market = this.market (symbol);
        this.tickers[symbol] = ticker;
        const name = 'SubscribeLevel1';
        const messageHash = name + ':' + market['id'];
        client.resolve (ticker, messageHash);
    }

    /**
     * @method
     * @name ndax#watchTrades
     * @description get the list of most recent trades for a particular symbol
     * @see https://apidoc.ndax.io/#subscribetrades
     * @param {string} symbol unified symbol of the market to fetch trades for
     * @param {int} [since] timestamp in ms of the earliest trade to fetch
     * @param {int} [limit] the maximum amount of trades to fetch
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object[]} a list of [trade structures]{@link https://docs.ccxt.com/#/?id=public-trades}
     */
    async watchTrades (symbol: string, since: Int = undefined, limit: Int = undefined, params = {}): Promise<Trade[]> {
        const omsId = this.safeInteger (this.options, 'omsId', 1);
        await this.loadMarkets ();
        const market = this.market (symbol);
        symbol = market['symbol'];
        const name = 'SubscribeTrades';
        const messageHash = name + ':' + market['id'];
        const url = this.urls['api']['ws'];
        const requestId = this.requestId ();
        const payload: Dict = {
            'OMSId': omsId,
            'InstrumentId': parseInt (market['id']), // conditionally optional
            'IncludeLastCount': 100, // the number of previous trades to retrieve in the immediate snapshot, 100 by default
        };
        const request: Dict = {
            'm': 0, // message type, 0 request, 1 reply, 2 subscribe, 3 event, unsubscribe, 5 error
            'i': requestId, // sequence number identifies an individual request or request-and-response pair, to your application
            'n': name, // function name is the name of the function being called or that the server is responding to, the server echoes your call
            'o': this.json (payload), // JSON-formatted string containing the data being sent with the message
        };
        const message = this.extend (request, params);
        const trades = await this.watch (url, messageHash, message, messageHash);
        if (this.newUpdates) {
            limit = trades.getLimit (symbol, limit);
        }
        return this.filterBySinceLimit (trades, since, limit, 'timestamp', true);
    }

    handleTrades (client: Client, message) {
        const payload = this.safeValue (message, 'o', []);
        //
        // initial snapshot
        //
        //     [
        //         [
        //             6913253,       //  0 TradeId
        //             8,             //  1 ProductPairCode
        //             0.03340802,    //  2 Quantity
        //             19116.08,      //  3 Price
        //             2543425077,    //  4 Order1
        //             2543425482,    //  5 Order2
        //             1606935922416, //  6 Tradetime
        //             0,             //  7 Direction
        //             1,             //  8 TakerSide
        //             0,             //  9 BlockTrade
        //             0,             // 10 Either Order1ClientId or Order2ClientId
        //         ]
        //     ]
        //
        const name = 'SubscribeTrades';
        const updates: Dict = {};
        for (let i = 0; i < payload.length; i++) {
            const trade = this.parseTrade (payload[i]);
            const symbol = trade['symbol'];
            let tradesArray = this.safeValue (this.trades, symbol);
            if (tradesArray === undefined) {
                const limit = this.safeInteger (this.options, 'tradesLimit', 1000);
                tradesArray = new ArrayCache (limit);
            }
            tradesArray.append (trade);
            this.trades[symbol] = tradesArray;
            updates[symbol] = true;
        }
        const symbols = Object.keys (updates);
        for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i];
            const market = this.market (symbol);
            const messageHash = name + ':' + market['id'];
            const tradesArray = this.safeValue (this.trades, symbol);
            client.resolve (tradesArray, messageHash);
        }
    }

    /**
     * @method
     * @name ndax#watchOHLCV
     * @description watches historical candlestick data containing the open, high, low, and close price, and the volume of a market
     * @see https://apidoc.ndax.io/#subscribeticker
     * @param {string} symbol unified symbol of the market to fetch OHLCV data for
     * @param {string} timeframe the length of time each candle represents
     * @param {int} [since] timestamp in ms of the earliest candle to fetch
     * @param {int} [limit] the maximum amount of candles to fetch
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {int[][]} A list of candles ordered as timestamp, open, high, low, close, volume
     */
    async watchOHLCV (symbol: string, timeframe: string = '1m', since: Int = undefined, limit: Int = undefined, params = {}): Promise<OHLCV[]> {
        const omsId = this.safeInteger (this.options, 'omsId', 1);
        await this.loadMarkets ();
        const market = this.market (symbol);
        symbol = market['symbol'];
        const name = 'SubscribeTicker';
        const messageHash = name + ':' + timeframe + ':' + market['id'];
        const url = this.urls['api']['ws'];
        const requestId = this.requestId ();
        const payload: Dict = {
            'OMSId': omsId,
            'InstrumentId': parseInt (market['id']), // conditionally optional
            'Interval': parseInt (this.safeString (this.timeframes, timeframe, timeframe)),
            'IncludeLastCount': 100, // the number of previous candles to retrieve in the immediate snapshot, 100 by default
        };
        const request: Dict = {
            'm': 0, // message type, 0 request, 1 reply, 2 subscribe, 3 event, unsubscribe, 5 error
            'i': requestId, // sequence number identifies an individual request or request-and-response pair, to your application
            'n': name, // function name is the name of the function being called or that the server is responding to, the server echoes your call
            'o': this.json (payload), // JSON-formatted string containing the data being sent with the message
        };
        const message = this.extend (request, params);
        const ohlcv = await this.watch (url, messageHash, message, messageHash);
        if (this.newUpdates) {
            limit = ohlcv.getLimit (symbol, limit);
        }
        return this.filterBySinceLimit (ohlcv, since, limit, 0, true);
    }

    handleOHLCV (client: Client, message) {
        //
        //     {
        //         "m": 1,
        //         "i": 1,
        //         "n": "SubscribeTicker",
        //         "o": [[1608284160000,23113.52,23070.88,23075.76,23075.39,162.44964300,23075.38,23075.39,8,1608284100000]],
        //     }
        //
        const payload = this.safeValue (message, 'o', []);
        //
        //     [
        //         [
        //             1501603632000,      // 0 DateTime
        //             2700.33,            // 1 High
        //             2687.01,            // 2 Low
        //             2687.01,            // 3 Open
        //             2687.01,            // 4 Close
        //             24.86100992,        // 5 Volume
        //             0,                  // 6 Inside Bid Price
        //             2870.95,            // 7 Inside Ask Price
        //             1                   // 8 InstrumentId
        //             1608290188062.7678, // 9 candle timestamp
        //         ]
        //     ]
        //
        const updates: Dict = {};
        for (let i = 0; i < payload.length; i++) {
            const ohlcv = payload[i];
            const marketId = this.safeString (ohlcv, 8);
            const market = this.safeMarket (marketId);
            const symbol = market['symbol'];
            updates[marketId] = {};
            this.ohlcvs[symbol] = this.safeValue (this.ohlcvs, symbol, {});
            const keys = Object.keys (this.timeframes);
            for (let j = 0; j < keys.length; j++) {
                const timeframe = keys[j];
                const interval = this.safeString (this.timeframes, timeframe, timeframe);
                const duration = parseInt (interval) * 1000;
                const timestamp = this.safeInteger (ohlcv, 0);
                const parsed = [
                    this.parseToInt ((timestamp / duration) * duration),
                    this.safeFloat (ohlcv, 3),
                    this.safeFloat (ohlcv, 1),
                    this.safeFloat (ohlcv, 2),
                    this.safeFloat (ohlcv, 4),
                    this.safeFloat (ohlcv, 5),
                ];
                const stored = this.safeValue (this.ohlcvs[symbol], timeframe, []);
                const length = stored.length;
                if (length && (parsed[0] === stored[length - 1][0])) {
                    const previous = stored[length - 1];
                    stored[length - 1] = [
                        parsed[0],
                        previous[1],
                        Math.max (parsed[1], previous[1]),
                        Math.min (parsed[2], previous[2]),
                        parsed[4],
                        this.sum (parsed[5], previous[5]),
                    ];
                    updates[marketId][timeframe] = true;
                } else {
                    if (length && (parsed[0] < stored[length - 1][0])) {
                        continue;
                    } else {
                        stored.push (parsed);
                        const limit = this.safeInteger (this.options, 'OHLCVLimit', 1000);
                        if (length >= limit) {
                            stored.shift ();
                        }
                        updates[marketId][timeframe] = true;
                    }
                }
                this.ohlcvs[symbol][timeframe] = stored;
            }
        }
        const name = 'SubscribeTicker';
        const marketIds = Object.keys (updates);
        for (let i = 0; i < marketIds.length; i++) {
            const marketId = marketIds[i];
            const timeframes = Object.keys (updates[marketId]);
            for (let j = 0; j < timeframes.length; j++) {
                const timeframe = timeframes[j];
                const messageHash = name + ':' + timeframe + ':' + marketId;
                const market = this.safeMarket (marketId);
                const symbol = market['symbol'];
                const stored = this.safeValue (this.ohlcvs[symbol], timeframe, []);
                client.resolve (stored, messageHash);
            }
        }
    }

    /**
     * @method
     * @name ndax#watchOrderBook
     * @description watches information on open orders with bid (buy) and ask (sell) prices, volumes and other data
     * @see https://apidoc.ndax.io/#subscribelevel2
     * @param {string} symbol unified symbol of the market to fetch the order book for
     * @param {int} [limit] the maximum amount of order book entries to return
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} A dictionary of [order book structures]{@link https://docs.ccxt.com/#/?id=order-book-structure} indexed by market symbols
     */
    async watchOrderBook (symbol: string, limit: Int = undefined, params = {}): Promise<OrderBook> {
        const omsId = this.safeInteger (this.options, 'omsId', 1);
        await this.loadMarkets ();
        const market = this.market (symbol);
        symbol = market['symbol'];
        const name = 'SubscribeLevel2';
        const messageHash = name + ':' + market['id'];
        const url = this.urls['api']['ws'];
        const requestId = this.requestId ();
        limit = (limit === undefined) ? 100 : limit;
        const payload: Dict = {
            'OMSId': omsId,
            'InstrumentId': parseInt (market['id']), // conditionally optional
            // 'Symbol': market['info']['symbol'], // conditionally optional
            'Depth': limit, // default 100
        };
        const request: Dict = {
            'm': 0, // message type, 0 request, 1 reply, 2 subscribe, 3 event, unsubscribe, 5 error
            'i': requestId, // sequence number identifies an individual request or request-and-response pair, to your application
            'n': name, // function name is the name of the function being called or that the server is responding to, the server echoes your call
            'o': this.json (payload), // JSON-formatted string containing the data being sent with the message
        };
        const subscription: Dict = {
            'id': requestId,
            'messageHash': messageHash,
            'name': name,
            'symbol': symbol,
            'marketId': market['id'],
            'method': this.handleOrderBookSubscription,
            'limit': limit,
            'params': params,
        };
        const message = this.extend (request, params);
        const orderbook = await this.watch (url, messageHash, message, messageHash, subscription);
        return orderbook.limit ();
    }

    handleOrderBook (client: Client, message) {
        //
        //     {
        //         "m": 3,
        //         "i": 2,
        //         "n": "Level2UpdateEvent",
        //         "o": [[2,1,1608208308265,0,20782.49,1,25000,8,1,1]]
        //     }
        //
        const payload = this.safeValue (message, 'o', []);
        //
        //     [
        //         0,   // 0 MDUpdateId
        //         1,   // 1 Number of Unique Accounts
        //         123, // 2 ActionDateTime in Posix format X 1000
        //         0,   // 3 ActionType 0 (New), 1 (Update), 2(Delete)
        //         0.0, // 4 LastTradePrice
        //         0,   // 5 Number of Orders
        //         0.0, // 6 Price
        //         0,   // 7 ProductPairCode
        //         0.0, // 8 Quantity
        //         0,   // 9 Side
        //     ],
        //
        const firstBidAsk = this.safeValue (payload, 0, []);
        const marketId = this.safeString (firstBidAsk, 7);
        if (marketId === undefined) {
            return;
        }
        const market = this.safeMarket (marketId);
        const symbol = market['symbol'];
        const orderbook = this.safeValue (this.orderbooks, symbol);
        if (orderbook === undefined) {
            return;
        }
        let timestamp = undefined;
        let nonce = undefined;
        for (let i = 0; i < payload.length; i++) {
            const bidask = payload[i];
            if (timestamp === undefined) {
                timestamp = this.safeInteger (bidask, 2);
            } else {
                const newTimestamp = this.safeInteger (bidask, 2);
                timestamp = Math.max (timestamp, newTimestamp);
            }
            if (nonce === undefined) {
                nonce = this.safeInteger (bidask, 0);
            } else {
                const newNonce = this.safeInteger (bidask, 0);
                nonce = Math.max (nonce, newNonce);
            }
            // 0 new, 1 update, 2 remove
            const type = this.safeInteger (bidask, 3);
            const price = this.safeFloat (bidask, 6);
            const amount = this.safeFloat (bidask, 8);
            const side = this.safeInteger (bidask, 9);
            // 0 buy, 1 sell, 2 short reserved for future use, 3 unknown
            const orderbookSide = (side === 0) ? orderbook['bids'] : orderbook['asks'];
            // 0 new, 1 update, 2 remove
            if (type === 0) {
                orderbookSide.store (price, amount);
            } else if (type === 1) {
                orderbookSide.store (price, amount);
            } else if (type === 2) {
                orderbookSide.store (price, 0);
            }
        }
        orderbook['nonce'] = nonce;
        orderbook['timestamp'] = timestamp;
        orderbook['datetime'] = this.iso8601 (timestamp);
        const name = 'SubscribeLevel2';
        const messageHash = name + ':' + marketId;
        this.orderbooks[symbol] = orderbook;
        client.resolve (orderbook, messageHash);
    }

    handleOrderBookSubscription (client: Client, message, subscription) {
        //
        //     {
        //         "m": 1,
        //         "i": 1,
        //         "n": "SubscribeLevel2",
        //         "o": [[1,1,1608204295901,0,20782.49,1,18200,8,1,0]]
        //     }
        //
        const payload = this.safeValue (message, 'o', []);
        //
        //     [
        //         [
        //             0,   // 0 MDUpdateId
        //             1,   // 1 Number of Unique Accounts
        //             123, // 2 ActionDateTime in Posix format X 1000
        //             0,   // 3 ActionType 0 (New), 1 (Update), 2(Delete)
        //             0.0, // 4 LastTradePrice
        //             0,   // 5 Number of Orders
        //             0.0, // 6 Price
        //             0,   // 7 ProductPairCode
        //             0.0, // 8 Quantity
        //             0,   // 9 Side
        //         ],
        //     ]
        //
        const symbol = this.safeString (subscription, 'symbol');
        const snapshot = this.parseOrderBook (payload, symbol);
        const limit = this.safeInteger (subscription, 'limit');
        const orderbook = this.orderBook (snapshot, limit);
        this.orderbooks[symbol] = orderbook;
        const messageHash = this.safeString (subscription, 'messageHash');
        client.resolve (orderbook, messageHash);
    }

    handleSubscriptionStatus (client: Client, message) {
        //
        //     {
        //         "m": 1,
        //         "i": 1,
        //         "n": "SubscribeLevel2",
        //         "o": "[[1,1,1608204295901,0,20782.49,1,18200,8,1,0]]"
        //     }
        //
        const subscriptionsById = this.indexBy (client.subscriptions, 'id');
        const id = this.safeInteger (message, 'i');
        const subscription = this.safeValue (subscriptionsById, id);
        if (subscription !== undefined) {
            const method = this.safeValue (subscription, 'method');
            if (method !== undefined) {
                method.call (this, client, message, subscription);
            }
        }
    }

    handleMessage (client: Client, message) {
        //
        //     {
        //         "m": 0, // message type, 0 request, 1 reply, 2 subscribe, 3 event, unsubscribe, 5 error
        //         "i": 0, // sequence number identifies an individual request or request-and-response pair, to your application
        //         "n":"function name", // function name is the name of the function being called or that the server is responding to, the server echoes your call
        //         "o":"payload", // JSON-formatted string containing the data being sent with the message
        //     }
        //
        //     {
        //         "m": 1,
        //         "i": 1,
        //         "n": "SubscribeLevel2",
        //         "o": "[[1,1,1608204295901,0,20782.49,1,18200,8,1,0]]"
        //     }
        //
        //     {
        //         "m": 3,
        //         "i": 2,
        //         "n": "Level2UpdateEvent",
        //         "o": "[[2,1,1608208308265,0,20782.49,1,25000,8,1,1]]"
        //     }
        //
        const payload = this.safeString (message, 'o');
        if (payload === undefined) {
            return;
        }
        message['o'] = JSON.parse (payload);
        const methods: Dict = {
            'AuthenticateUser': this.handleAuthenticate,
            'SubscribeLevel2': this.handleSubscriptionStatus,
            'SubscribeLevel1': this.handleTicker,
            'Level2UpdateEvent': this.handleOrderBook,
            'Level1UpdateEvent': this.handleTicker,
            'SubscribeTrades': this.handleTrades,
            'TradeDataUpdateEvent': this.handleTrades,
            'SubscribeTicker': this.handleOHLCV,
            'TickerDataUpdateEvent': this.handleOHLCV,
            'SubscribeAccountEvents': this.handleSubscribeAccountEvents,
            'AccountPositionEvent': this.handleBalance,
            'OrderStateEvent': this.handleOrders,
            'OrderTradeEvent': this.handleMyTrades,
            'Ping': this.handlePong,
        };
        const event = this.safeString (message, 'n');
        const method = this.safeValue (methods, event);
        if (method !== undefined) {
            method.call (this, client, message);
        }
    }

    ping (client: Client) {
        const requestId = this.requestId ();
        const request: Dict = {
            'm': 0, // message type, 0 request, 1 reply, 2 subscribe, 3 event, unsubscribe, 5 error
            'i': requestId, // sequence number identifies an individual request or request-and-response pair, to your application
            'n': 'Ping', // function name is the name of the function being called or that the server is responding to, the server echoes your call
            'o': '{ }', // JSON-formatted string containing the data being sent with the message
        };
        return request;
    }

    handlePong (client: Client, message) {
        //
        // PONG
        //
        client.lastPong = this.milliseconds ();
        return message;
    }

    async authenticate (params = {}) {
        this.checkRequiredCredentials ();
        const name = 'AuthenticateUser';
        const messageHash = 'authenticated';
        const url = this.urls['api']['ws'];
        const client = this.client (url);
        const future = client.future (messageHash);
        const authenticated = this.safeValue (client.subscriptions, messageHash);
        if (authenticated === undefined) {
            const nonce = this.nonce ().toString ();
            const auth = nonce + this.uid + this.apiKey;
            const signature = this.hmac (this.encode (auth), this.encode (this.secret), sha256);
            const requestId = this.requestId ();
            const payload: Dict = {
                'APIKey': this.apiKey,
                'Signature': signature,
                'UserId': this.uid,
                'Nonce': nonce,
            };
            const request: Dict = {
                'm': 0, // message type, 0 request, 1 reply, 2 subscribe, 3 event, unsubscribe, 5 error
                'i': requestId, // sequence number identifies an individual request or request-and-response pair, to your application
                'n': name, // function name is the name of the function being called or that the server is responding to, the server echoes your call
                'o': this.json (payload), // JSON-formatted string containing the data being sent with the message
            };
            const subscription: Dict = {
                'id': requestId,
                'messageHash': messageHash,
                'name': name,
                'params': params,
            };
            this.watch (url, messageHash, request, messageHash, subscription);
        }
        return await future;
    }

    handleAuthenticate (client: Client, message) {
        //
        // {
        //     "m":1,
        //     "i":1,
        //     "n":"AuthenticateUser",
        //     "o":"{
        //             "Authenticated":true,
        //             "SessionToken":"asdf",
        //             "User":{
        //                "UserId":123456,
        //                "UserName":"ndax1234",
        //                "Email":"foo@bar.com",
        //                "EmailVerified":true,
        //                "AccountId":987654,
        //                "OMSId":1,
        //                "Use2FA":true
        //             },
        //             "Locked":false,
        //             "Requires2FA":false,
        //             "EnforceEnable2FA":false,
        //             "TwoFAType":null,
        //             "TwoFAToken":null,
        //             "errormsg":null
        //         }"
        // }
        const payload = this.safeValue (message, 'o', []);
        if (payload['Authenticated'] === true) {
            const promise = client.futures['authenticated'];
            promise.resolve (message);
            return;
        }
        throw new AuthenticationError (this.id + ' failed to authenticate.');
    }

    async watchAccountEvents (messageHash, params = {}) {
        // This function is used to by watchBalance, watchOrders, and watchMyTrades
        await this.loadMarkets ();
        await this.loadAccounts ();
        await this.authenticate ();
        const omsId = this.safeInteger (this.options, 'omsId', 1);
        const defaultAccountId = this.safeInteger2 (this.options, 'accountId', 'AccountId');
        let accountId = this.safeInteger2 (params, 'accountId', 'AccountId', defaultAccountId);
        if (accountId === undefined) {
            accountId = parseInt (this.accounts[0]['id']);
        }
        const name = 'SubscribeAccountEvents';
        const url = this.urls['api']['ws'];
        const requestId = this.requestId ();
        const payload: Dict = {
            'AccountId': accountId,
            'OMSId': omsId,
        };
        const request: Dict = {
            'm': 0, // message type, 0 request, 1 reply, 2 subscribe, 3 event, unsubscribe, 5 error
            'i': requestId, // sequence number identifies an individual request or request-and-response pair, to your application
            'n': name, // function name is the name of the function being called or that the server is responding to, the server echoes your call
            'o': this.json (payload), // JSON-formatted string containing the data being sent with the message
        };
        const subscription: Dict = {
            'id': requestId,
            'messageHash': messageHash,
            'name': name,
            'params': params,
        };
        const message = this.extend (request, params);
        return await this.watch (url, messageHash, message, name, subscription);
    }

    handleSubscribeAccountEvents (client: Client, message) {
        //
        // {
        //     "m":1,
        //     "i":2,
        //     "n":"SubscribeAccountEvents",
        //     "o":"{ "Subscribed": true }"
        //  }
        const payload = this.safeValue (message, 'o', []);
        if (payload['Subscribed'] !== true) {
            throw new ExchangeError (this.id + ' failed to subscribe to account events.');
        }
    }

    /**
     * @method
     * @name ndax#watchBalance
     * @description subscribe to balance for an account
     * @see https://apidoc.ndax.io/#subscribeaccountevents
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} a [balance structure]{@link https://docs.ccxt.com/#/?id=balance-structure}
     */
    async watchBalance (params = {}): Promise<Balances> {
        return await this.watchAccountEvents ('balance', params);
    }

    handleBalance (client: Client, message) {
        //
        // {
        //     "OMSId":4, //The OMSId. [Integer]
        //     "AccountId":4, // account id number. [Integer]
        //     "ProductSymbol":"BTC", //The Product Symbol for this balance message. [String]
        //     "ProductId":1, //The Product Id for this balance message. [Integer]
        //     "Amount":10499.1,  //The total balance in the account for the specified product. [Dec]
        //     "Hold": 2.1,  //The total amount of the balance that is on hold. Your available                          //balance for trading and withdraw is (Amount - Hold). [Decimal]
        //     "PendingDeposits":0, //Total Deposits Pending for the specified product. [Decimal]
        //     "PendingWithdraws":0, //Total Withdrawals Pending for the specified product. [Decimal]
        //     "TotalDayDeposits":0, //The total 24-hour deposits for the specified product. UTC. [Dec]
        //     "TotalDayWithdraws":0 //The total 24-hour withdraws for the specified product. UTC [Dec]
        // }
        //
        const messageHash = 'balance';
        const payload = this.safeValue (message, 'o', []);
        const balance = this.parseBalance ([ payload ]);
        client.resolve (balance, messageHash);
    }

    /**
     * @method
     * @name ndax#watchOrders
     * @description subscribe to orders for an account
     * @see https://apidoc.ndax.io/#subscribeaccountevents
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} a list of [order structures]{@link https://docs.ccxt.com/#/?id=order-structure}
     */
    async watchOrders (params = {}): Promise<Order[]> {
        return await this.watchAccountEvents ('orders', params);
    }

    handleOrders (client: Client, message) {
        //
        // {
        //     "Side":"Sell",
        //         // The side of your order. [String] Values are "Sell",
        //         // "Buy", "Short"
        //     "OrderId": 9849, //The Server-Assigned Order Id. [64-bit Integer]
        //     "Price": 97, //The Price of your order. [Decimal]
        //     "Quantity":1,
        //         // The Quantity (Remaining if partially or fully executed) of
        //         // your order. [Decimal]
        //     "Instrument":1, // The InstrumentId your order is for. [Integer]
        //     "Account":4, // Your AccountId [Integer]
        //     "OrderType":"Limit",
        //         // The type of order. [String] Values are "Market", "Limit",
        //         // "StopMarket", "StopLimit", "TrailingStopMarket", and
        //         // "TrailingStopLimit"
        //     "ClientOrderId":0, // Your client order id. [64-bit Integer]
        //     "OrderState":"Working", // The current state of the order. [String]
        //             // Values are "Working", "Rejected", "FullyExecuted", "Canceled",
        //             // "Expired"
        //     "ReceiveTime":0, // Timestamp in POSIX format
        //     "OrigQuantity":1, // The original quantity of your order. [Decimal]
        //     "QuantityExecuted":0, // The total executed quantity. [Decimal]
        //     "AvgPrice":0, // Avergage executed price. [Decimal]
        //     "ChangeReason":"NewInputAccepted"
        //         // The reason for the order state change. [String] Values are
        //         // "NewInputAccepted", "NewInputRejected", "OtherRejected",
        //         // "Expired", "Trade", SystemCanceled BelowMinimum",
        //         // "SystemCanceled NoMoreMarket", "UserModified"
        // }
        //
        const messageHash = 'orders';
        const payload = this.safeValue (message, 'o', []);
        const order = this.parseOrder (payload);
        client.resolve ([ order ], messageHash);
    }

    /**
     * @method
     * @name ndax#watchMyTrades
     * @description subscribe to trades made by an account
     * @see https://apidoc.ndax.io/#subscribeaccountevents
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} a list of [trade structures]{@link https://docs.ccxt.com/#/?id=trade-structure}
     */
    async watchMyTrades (params = {}): Promise<Trade[]> {
        return await this.watchAccountEvents ('myTrades', params);
    }

    handleMyTrades (client: Client, message) {
        //
        // {
        //     "OMSId":1, //OMS Id [Integer]
        //     "TradeId":213, //Trade Id [64-bit Integer]
        //     "OrderId":9848, //Order Id [64-bit Integer]
        //     "AccountId":4, //Your Account Id [Integer]
        //     "ClientOrderId":0, //Your client order id. [64-bit Integer]
        //     "InstrumentId":1, //Instrument Id [Integer]
        //     "Side":"Buy", //[String] Values are "Buy", "Sell", "Short" (future)
        //     "Quantity":0.01, //Quantity [Decimal]
        //     "Price":95,  //Price [Decimal]
        //     "Value":0.95,  //Value [Decimal]
        //     "TradeTime":635978008210426109, // TimeStamp in Microsoft ticks format
        //     "ContraAcctId":3,
        //         // The Counterparty of the trade. The counterparty is always
        //         // the clearing account. [Integer]
        //     "OrderTradeRevision":1, //Usually 1
        //     "Direction":"NoChange" //"Uptick", "Downtick", "NoChange"
        // }
        //
        const messageHash = 'myTrades';
        const payload = this.safeValue (message, 'o', []);
        const trade = this.parseTrade (payload);
        client.resolve ([ trade ], messageHash);
    }
}
