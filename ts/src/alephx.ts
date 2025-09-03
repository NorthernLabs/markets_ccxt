// ----------------------------------------------------------------------------

import Exchange from './abstract/alephx.js';
import { AuthenticationError, ExchangeError, BadRequest, OrderNotFound, PermissionDenied } from './base/errors.js';
import { sha256 } from './static_dependencies/noble-hashes/sha256.js';
import type { Balances, Int, OrderSide, OrderType, Order, Trade, Str, Market, Num, Dict, int } from './base/types.js';

// ----------------------------------------------------------------------------

/**
 * @class alephx
 * @augments Exchange
 */
export default class alephx extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'alephx',
            'name': 'AlephX',
            'countries': [ 'CA' ],
            'pro': true,
            'certified': false,
            // rate-limits: N/A
            'rateLimit': 1000,
            'version': 'v1',
            'userAgent': this.userAgents['chrome'],
            // 'headers': {
            //     'ZKX-VERSION': '2018-05-30',
            // },
            'has': {
                'CORS': true,
                'spot': true,
                'margin': false,
                'swap': false,
                'future': false,
                'option': false,
                'addMargin': false,
                'cancelOrder': true,
                'cancelOrders': false,
                'createDepositAddress': false,
                'createLimitBuyOrder': false,
                'createLimitSellOrder': false,
                'createMarketBuyOrder': false,
                'createMarketBuyOrderWithCost': false,
                'createMarketOrderWithCost': false,
                'createMarketSellOrder': false,
                'createMarketSellOrderWithCost': false,
                'createOrder': true,
                'createPostOnlyOrder': false,
                'createReduceOnlyOrder': false,
                'createStopLimitOrder': false,
                'createStopMarketOrder': false,
                'createStopOrder': true,
                'deposit': false,
                'editOrder': false,
                'fetchAccounts': false,
                'fetchBalance': true,
                'fetchBidsAsks': false,
                'fetchCanceledOrders': false,
                'fetchCurrencies': false,
                'fetchDeposit': false,
                'fetchDepositAddress': false,
                'fetchDepositAddresses': false,
                'fetchDepositAddressesByNetwork': false,
                'fetchDeposits': false,
                'fetchFundingHistory': false,
                'fetchFundingRate': false,
                'fetchFundingRateHistory': false,
                'fetchFundingRates': false,
                'fetchIndexOHLCV': false,
                'fetchIsolatedBorrowRate': false,
                'fetchIsolatedBorrowRates': false,
                'fetchL2OrderBook': false,
                'fetchLedger': false,
                'fetchLeverage': false,
                'fetchLeverageTiers': false,
                'fetchMarginMode': false,
                'fetchMarkets': true,
                'fetchMarkOHLCV': false,
                'fetchMyBuys': false,
                'fetchMySells': false,
                'fetchMyTrades': true,
                'fetchOHLCV': false,
                'fetchOpenInterestHistory': false,
                'fetchOpenOrders': false,
                'fetchOrder': true,
                'fetchOrderBook': false,
                'fetchOrders': true,
                'fetchOrderTrades': true,
                'fetchPosition': false,
                'fetchPositionMode': false,
                'fetchPositions': false,
                'fetchPositionsRisk': false,
                'fetchPremiumIndexOHLCV': false,
                'fetchStatus': true,
                'fetchTicker': false,
                'fetchTickers': false,
                'fetchTime': false,
                'fetchTrades': false,
                'fetchTradingFee': 'emulated',
                'fetchTradingFees': false,
                'fetchWithdrawals': false,
                'reduceMargin': false,
                'sandbox': true,
                'setLeverage': false,
                'setMarginMode': false,
                'setPositionMode': false,
                'withdraw': false,
            },
            'urls': {
                // 'logo': 'https://user-images.githubusercontent.com/1294454/40811661-b6eceae2-653a-11e8-829e-10bfadb078cf.jpg',
                'test': {
                    'rest': 'https://api-testnet.alephx.xyz',
                },
                'api': {
                    'rest': 'https://api.alephx.xyz',
                },
                'www': 'https://demo.alephx.xyz',
                // 'doc': [
                //     'https://developers.alephx.com/api/v1',
                // ],
                // 'fees': [
                //     'https://support.alephx.com/customer/portal/articles/2109597-buy-sell-bank-transfer-fees',
                // ],
            },
            'requiredCredentials': {
                'apiKey': true,
                'secret': true,
            },
            'api': {
                'v1': {
                    'public': {
                        'get': {
                            'system/status': 0,
                            'trading-pairs': 0,
                        },
                    },
                    'private': {
                        'get': {
                            'assets/balances': 0,
                            'orders': 0,
                            'orders/{id}': 0,
                            'trades': 0,
                        },
                        'post': {
                            'orders': 0,
                        },
                        'patch': {
                            'orders/{id}/cancel': 0,
                        },
                    },
                },
            },
            'exceptions': {
                'exact': {},
                'broad': {
                    'Wallet not allowed': AuthenticationError,
                    'Invalid signature': AuthenticationError,
                    'Unauthorized': PermissionDenied,
                    'Order is not cancellable': BadRequest,
                    'Asset is not supported': BadRequest,
                    'Not Found': OrderNotFound,
                },
            },
            'commonCurrencies': {
                'XBTC': 'BTC',
                'XETH': 'ETH',
                'XUSDC': 'USDC',
            },
        });
    }

    /**
     * @method
     * @name alephx#fetchMarkets
     * @description retrieves data on all markets for alephx
     * @see https://api.alephx.xyz/ui/v1/trading-pairs
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object[]} an array of objects representing market data
     */
    async fetchMarkets (params = {}): Promise<Market[]> {
        const response = await this.v1PublicGetTradingPairs (params);
        // [
        //     {
        //      "id":"f178aed2-4d1e-4d1b-add8-4f19c584d25b",
        //      "symbol":"xETH-ALEO",
        //      "is_active":true,
        //      "price_decimal_precision":6,
        //      "min_order_quantity":"0.0001",
        //      "max_order_quantity":"1000",
        //      "base_asset":"xETH",
        //      "quote_asset":"ALEO"
        //   }
        // ]
        //
        const data = response;
        let result = [];
        for (let i = 0; i < data.length; i++) {
            const market = data[i];
            const baseId = this.safeString (market, 'base_asset');
            const quoteId = this.safeString (market, 'quote_asset');
            const base = this.safeCurrencyCode (baseId);
            const quote = this.safeCurrencyCode (quoteId);
            const isActive = this.safeBool (market, 'is_active');
            let symbol = base + '/' + quote;
            result.push ({
                'id': this.safeString (market, 'symbol'),
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'settle': undefined,
                'baseId': baseId,
                'quoteId': quoteId,
                'settleId': undefined,
                'type': 'spot',
                'spot': true,
                'margin': false,
                'swap': false,
                'future': false,
                'option': false,
                'active': isActive,
                'contract': false,
                'linear': undefined,
                'inverse': undefined,
                'contractSize': undefined,
                'expiry': undefined,
                'expiryDatetime': undefined,
                'strike': undefined,
                'optionType': undefined,
                'precision': {
                    'amount': this.parseNumber (this.parsePrecision ('6')),
                    'price': this.parseNumber (this.parsePrecision (this.safeString (market, 'price_decimal_precision'))),
                },
                'limits': {
                    'leverage': {
                        'min': this.parseNumber ('1'),
                        'max': this.parseNumber ('1'),
                    },
                    'amount': {
                        'min': this.safeNumber (market, 'min_order_quantity'),
                        'max': this.safeNumber (market, 'max_order_quantity'),
                    },
                    'price': {
                        'min': undefined,
                        'max': undefined,
                    },
                    'cost': {
                        'min': undefined,
                        'max': undefined,
                    },
                },
                'created': undefined,
                'info': market,
            });
        }
        return result;
    }

    async createOrder (symbol: string, type: OrderType, side: OrderSide, amount: number, price: Num = undefined, params = {}) {
        /**
         * @method
         * @name alephx#createOrder
         * @description create an order
         * @see POST https://api.alephx.xyz/api/v1/orders
         * @param {string} symbol unified symbol of the market to create an order in
         * @param {string} type 'market' or 'limit'
         * @param {string} side 'buy' or 'sell'
         * @param {float} amount how much you want to trade in units of the base currency, quote currency for 'market' 'buy' orders
         * @param {float} [price] the price to fulfill the order, in units of the quote currency, ignored in market orders
         * @param {object} [params] extra parameters specific to the exchange API endpoint
         * @param {string} [params.timeInForce] 'gtc'
         * @param {string} [params.idempotencyKey] uuid for idempotency key
         * @returns {object} an [order structure]{@link https://docs.ccxt.com/#/?id=order-structure}
         */
        const request: Dict = {
            'symbol': symbol,
            'type': type,
            'side': side,
            'quantity': amount.toString (),
            'price': price.toString (),
            'time_in_force': this.safeString2 (params, 'timeInForce', 'gtc'),
            'idempotency_key': this.safeString2 (params, 'idempotencyKey', this.uuid ()),
        };
        const response = await this.v1PrivatePostOrders (request);
        //
        // successful order
        //
        //
        // failed order
        //
        //
        const errorResponse = this.safeDict (response, 'error');
        if (errorResponse !== undefined) {
            const errorReason = this.safeString (errorResponse, 'reason');
            const errorMessage = this.safeString (errorResponse, 'message');
            throw new ExchangeError (errorReason + '' + errorMessage);
        }
        return this.parseOrder (response);
    }

    parseOrder (order: Dict, market: Market = undefined): Order {
        //
        // createOrder
        //
        // {
        //    "order_id": "52cfe5e2-0b29-4c19-a245-a6a773de5030",
        //    "status": "pending_new"
        // }
        //
        //
        // fetchOrder, fetchOrders, cancelOrder
        //
        // {
        //     "id": "0da4eb8d-c108-4e6c-8c45-0b42fabd3a72",
        //     "status": "partially_filled",
        //     "type": "limit",
        //     "symbol": "CLEO-ALEO",
        //     "account_id": "cb77b9ab-f94d-4013-85b7-644b0b9ba9a9",
        //     "settled_quantity": "0",
        //     "base_quantity": "0.1",
        //     "filled_quantity": "0.04",
        //     "side": "buy",
        //     "price": "12.3",
        //     "remained_quantity": "0.06",
        //     "idempotency_key": "99888999-93ef-9831-9829-120a082bfcf2",
        //     "inserted_at": "2024-09-16T23:47:45.161888Z",
        //     "fee_asset":null,
        //     "filled_at": "2024-09-26T20:08:11.350542Z",
        //     "average_filled_price": "12.3",
        //     "canceled_at":null,"cumulative_fee": "0",
        //     "time_in_force": "gtc",
        //     "internal_status": "partially_filled"
        // }
        //
        const createdDateTime = this.safeString (order, 'inserted_at');
        const filledDateTime = this.safeString (order, 'filled_at');
        return this.safeOrder ({
            'info': order,
            'id': this.safeString (order, 'order_id') || this.safeString (order, 'id'),
            'clientOrderId': this.safeString (order, 'idempotency_key'),
            'timestamp': createdDateTime ? this.parse8601 (createdDateTime) : undefined,
            'datetime': createdDateTime,
            'lastTradeTimestamp': filledDateTime ? this.parse8601 (filledDateTime) : undefined,
            'symbol': this.safeString (order, 'symbol'),
            'type': this.safeString (order, 'type'),
            'timeInForce': this.safeString (order, 'time_in_force', 'gtc'),
            'postOnly': true,
            'side': this.safeStringLower (order, 'side'),
            'price': this.safeString (order, 'price'),
            'stopPrice': undefined,
            'triggerPrice': undefined,
            'amount': this.safeString (order, 'base_quantity'),
            'filled': this.safeString (order, 'filled_quantity'),
            'remaining': this.safeString (order, 'remained_quantity'),
            'cost': undefined,
            'average': this.safeString (order, 'average_filled_price'),
            'status': this.safeString (order, 'status'),
            'fee': {
                'cost': this.safeString (order, 'cumulative_fee'),
                'currency': this.safeString (order, 'fee_asset'),
            },
            'trades': undefined,
        }, market);
    }

    async cancelOrder (id: string, symbol: Str = undefined, params = {}) {
        /**
         * @method
         * @name alephx#cancelOrder
         * @description cancels an open order
         * @see PATCH https://api.alephx.xyz/api/v1/orders/{order_id}/cancel
         * @param {string} id order id
         * @param {string} symbol not used by alephx cancelOrder()
         * @param {object} [params] extra parameters specific to the exchange API endpoint
         * @returns {object} An [order structure]{@link https://docs.ccxt.com/#/?id=order-structure}
         */
        const request: Dict = {
            'id': id, // order id
        };
        const response = await this.v1PrivatePatchOrdersIdCancel (this.extend (request, params));
        const errorResponse = this.safeDict (response, 'error');
        if (errorResponse !== undefined) {
            const errorReason = this.safeString (errorResponse, 'reason');
            const errorMessage = this.safeString (errorResponse, 'message');
            if (errorReason === 'Not Found') {
                throw new OrderNotFound (this.id + ' cancelOrder() error ' + errorReason);
            } else if (errorReason === 'Bad Request') {
                throw new BadRequest (this.id + ' cancelOrder() error ' + errorReason + ' ' + errorMessage);
            } else {
                throw new ExchangeError (errorReason + '' + errorMessage);
            }
        }
        return this.parseOrder (response);
    }

    async fetchOrder (id: string, symbol: Str = undefined, params = {}) {
        /**
         * @method
         * @name alephx#fetchOrder
         * @description fetches information on an order made by the user
         * @see GET https://api.alephx.xyz/api/v1/orders/{order_id}
         * @param {string} id the order id
         * @param {string} symbol unified market symbol that the order was made in
         * @param {object} [params] extra parameters specific to the exchange API endpoint
         * @returns {object} An [order structure]{@link https://docs.ccxt.com/#/?id=order-structure}
         */
        const request: Dict = {
            'id': id, // order id
        };
        const response = await this.v1PrivateGetOrdersId (this.extend (request, params));
        const errorResponse = this.safeDict (response, 'error');
        if (errorResponse !== undefined) {
            const errorReason = this.safeString (errorResponse, 'reason');
            if (errorReason === 'Not Found') {
                throw new OrderNotFound (this.id + ' fetchOrder() error ' + errorReason);
            }
        }
        return this.parseOrder (response);
    }

    async fetchOrders (symbol: Str = undefined, since: Int = undefined, limit: Int = 100, params = {}): Promise<Order[]> {
        /**
         * @method
         * @name alephx#fetchOrders
         * @description fetches information on multiple orders made by the user
         * @see GET https://api.alephx.xyz/api/v1/orders/
         * @param {string} symbol unified market symbol that the orders were made in
         * @param {int} [since] the earliest time in ms to fetch orders
         * @param {int} [limit] the maximum number of order structures to retrieve
         * @param {object} [params] extra parameters specific to the exchange API endpoint
         * @param {int} [params.until] the latest time in ms to fetch trades for
         * @param {boolean} [params.paginate] default false, when true will automatically paginate by calling this endpoint multiple times. See in the docs all the [availble parameters](https://github.com/ccxt/ccxt/wiki/Manual#pagination-params)
         * @returns {Order[]} a list of [order structures]{@link https://docs.ccxt.com/#/?id=order-structure}
         */
        const response = await this.v1PrivateGetOrders ();
        const market = undefined;
        return this.parseOrders (response, market, since, limit);
    }

    async fetchMyTrades (symbol: Str = undefined, since: Int = undefined, limit: Int = undefined, params = {}) {
        /**
         * @method
         * @name alephx#fetchMyTrades
         * @description fetch all trades made by the user
         * @see GET https://api.alephx.xyz/api/v1/trades
         * @param {string} symbol unified market symbol of the trades
         * @param {int} [since] timestamp in ms of the earliest order, default is undefined
         * @param {int} [limit] the maximum number of trade structures to fetch
         * @param {object} [params] extra parameters specific to the exchange API endpoint
         * @param {int} [params.until] the latest time in ms to fetch trades for
         * @param {boolean} [params.paginate] default false, when true will automatically paginate by calling this endpoint multiple times. See in the docs all the [availble parameters](https://github.com/ccxt/ccxt/wiki/Manual#pagination-params)
         * @returns {Trade[]} a list of [trade structures]{@link https://docs.ccxt.com/#/?id=trade-structure}
         */
        const response = await this.v1PrivateGetTrades ();
        const trades = this.safeList (response, 'data');
        const market = undefined;
        //
        // { "data": [
        //   { "id": "32672029-b46b-4139-9779-95444053f40a",
        //     "status": "unsettled",
        //     "symbol": "CLEO-ALEO",
        //     "base_quantity": "0.01",
        //     "side": "buy",
        //     "price": "12.3",
        //     "buy_order_id": "0da4eb8d-c108-4e6c-8c45-0b42fabd3a72",
        //     "sell_order_id": "86c61562-ff14-43c9-9a03-4be804d184d0",
        //     "quote_quantity": "0.123",
        //     "inserted_at": "2024-09-26T15:18:06.603489Z",
        //     "aggressor_side": "sell",
        //     "fee": null,
        //     "fee_asset": null,
        //     "updated_at": "2024-09-26T15:18:06.603489Z"
        //  }]}
        //
        return this.parseTrades (trades, market, since, limit);
    }

    parseTrade (trade: Dict, market: Market = undefined): Trade {
        // returned trade
        //
        // [
        //   {
        //     id: '32672029-b46b-4139-9779-95444053f40a',
        //     order: '0da4eb8d-c108-4e6c-8c45-0b42fabd3a72',
        //     info: {
        //     id: '32672029-b46b-4139-9779-95444053f40a',
        //     status: 'unsettled',
        //     symbol: 'CLEO-ALEO',
        //     base_quantity: '0.01',
        //     side: 'buy',
        //     price: '12.3',
        //     buy_order_id: '0da4eb8d-c108-4e6c-8c45-0b42fabd3a72',
        //     sell_order_id: '86c61562-ff14-43c9-9a03-4be804d184d0',
        //     quote_quantity: '0.123',
        //     inserted_at: '2024-09-26T15:18:06.603489Z',
        //     aggressor_side: 'sell',
        //     fee: null,
        //     fee_asset: null,
        //     updated_at: '2024-09-26T15:18:06.603489Z'
        //     },
        //     timestamp: 1727363886603,
        //     datetime: '2024-09-26T15:18:06.603489Z',
        //     symbol: 'CLEO-ALEO',
        //     type: undefined,
        //     side: 'buy',
        //     takerOrMaker: undefined,
        //     price: 12.3,
        //     amount: 0.01,
        //     cost: 0.123,
        //     fee: { cost: undefined, currency: undefined },
        //     fees: []
        //   }
        // ]
        const createdDateTime = this.safeString (trade, 'inserted_at');
        const traderSide = this.safeString (trade, 'side');
        const traderOrderId = (traderSide === 'buy') ? this.safeString (trade, 'buy_order_id') : this.safeString (trade, 'sell_order_id');
        return this.safeTrade ({
            'id': this.safeString (trade, 'id'),
            'order': traderOrderId,
            'info': trade,
            'timestamp': this.parse8601 (createdDateTime),
            'datetime': createdDateTime,
            'symbol': this.safeString (trade, 'symbol'),
            'type': 'gtc',
            'side': traderSide,
            'takerOrMaker': undefined,
            'price': this.safeString (trade, 'price'),
            'amount': this.safeString (trade, 'base_quantity'),
            'cost': this.safeString (trade, 'quote_quantity'),
            'fee': {
                'cost': this.safeString (trade, 'fee'),
                'currency': this.safeString (trade, 'fee_asset'),
            },
        }, market);
    }

    async fetchOrderTrades (id: string, symbol: Str = undefined, since: Int = undefined, limit: Int = undefined, params = {}) {
        /**
         * @method
         * @name alephx#fetchOrderTrades
         * @description fetch all the trades made from a single order
         * @see https://api.alephx.xyz/api/v1/trades?filters=[{"field":"order_id","op":"==","value":"order_id"}]
         * @param {string} id order id
         * @param {string} symbol unified market symbol
         * @param {int} [since] the earliest time in ms to fetch trades for
         * @param {int} [limit] the maximum number of trades to retrieve
         * @param {object} [params] extra parameters specific to the exchange API endpoint
         * @returns {object[]} a list of [trade structures]{@link https://docs.ccxt.com/#/?id=trade-structure}
         */
        const filters = [];
        const filter: Dict = {
            'field': 'order_id',
            'op': '==',
            'value': id,
        };
        filters.push (filter);
        const request: Dict = {
            'filters': JSON.stringify (filters),
        };
        const response = await this.v1PrivateGetTrades (request);
        const trades = this.safeList (response, 'data');
        const market = undefined;
        //
        // { "data": [
        //   { "id": "32672029-b46b-4139-9779-95444053f40a",
        //     "status": "unsettled",
        //     "symbol": "CLEO-ALEO",
        //     "base_quantity": "0.01",
        //     "side": "buy",
        //     "price": "12.3",
        //     "buy_order_id": "0da4eb8d-c108-4e6c-8c45-0b42fabd3a72",
        //     "sell_order_id": "86c61562-ff14-43c9-9a03-4be804d184d0",
        //     "quote_quantity": "0.123",
        //     "inserted_at": "2024-09-26T15:18:06.603489Z",
        //     "aggressor_side": "sell",
        //     "fee": null,
        //     "fee_asset": null,
        //     "updated_at": "2024-09-26T15:18:06.603489Z"
        //  }]}
        //
        return this.parseTrades (trades, market, since, limit);
    }

    async fetchStatus (params = {}) {
        /**
         * @method
         * @name alephx#fetchStatus
         * @description the latest known information on the availability of the exchange API
         * @see https://api.alephx.xyz/api/v1/system/status
         * @param {object} [params] extra parameters specific to the exchange API endpoint
         * @returns {object} a [status structure]{@link https://docs.ccxt.com/#/?id=exchange-status-structure}
         */
        const response = await this.v1PublicGetSystemStatus (params);
        //
        // OK
        //
        return {
            'status': (response === 'OK') ? 'ok' : 'maintenance',
            'updated': undefined,
            'eta': undefined,
            'url': undefined,
            'info': response,
        };
    }

    async fetchBalance (params = {}): Promise<Balances> {
        /**
         * @method
         * @name alephxn#fetchBalance
         * @description query for balance and get the amount of funds available for trading or funds locked in orders
         * @see https://api.alephx.xyz/api/v1/assets/balances
         * @param {object} [params] extra parameters specific to the exchange API endpoint
         * @returns {object} a [balance structure]{@link https://docs.ccxt.com/#/?id=balance-structure}
         */
        // await this.loadMarkets ();
        const response = await this.v1PrivateGetAssetsBalances (params);
        // [
        //     {
        //         "total": "19.996900",
        //         "available": "14.756900",
        //         "asset": "CLEO",
        //         "locked": "5.240000"
        //     },
        //     {
        //         "total": "10.054720",
        //         "available": "-52.145280",
        //         "asset": "ALEO",
        //         "locked": "62.200000"
        //     }
        // ]
        return this.parseBalance (response);
    }

    parseBalance (response): Balances {
        const balances = this.toArray (response);
        const result: Dict = {
            'info': response,
            'timestamp': undefined,
            'datetime': undefined,
        };
        for (let i = 0; i < balances.length; i++) {
            const balance = balances[i];
            const code = this.safeString (balance, 'asset');
            const account = this.account ();
            account['free'] = this.safeString (balance, 'available');
            account['used'] = this.safeString (balance, 'locked');
            account['total'] = this.safeString (balance, 'total');
            result[code] = account;
        }
        return this.safeBalance (result);
    }

    sign (path, api = [], method = 'GET', params = {}, headers = undefined, body = undefined) {
        const version = api[0];
        const signed = api[1] === 'private';
        let fullPath = '/api/' + version + '/' + this.implodeParams (path, params);
        const query = this.omit (params, this.extractParams (path));
        const savedPath = fullPath;
        if (method === 'GET') {
            if (Object.keys (query).length) {
                fullPath += '?' + this.urlencodeWithArrayRepeat (query);
            }
        }
        const url = this.urls['api']['rest'] + fullPath;
        if (signed) {
            const authorization = this.safeString (this.headers, 'Authorization');
            let authorizationString = undefined;
            if (authorization !== undefined) {
                authorizationString = authorization;
            } else if (this.token && !this.checkRequiredCredentials (false)) {
                authorizationString = 'Bearer ' + this.token;
            } else {
                this.checkRequiredCredentials ();
                if (method !== 'GET') {
                    if (Object.keys (query).length) {
                        body = this.json (query);
                    }
                }
                // doesn't need payload in the signature. inside url is enough
                const timestampString = this.seconds ().toString ();
                const auth = timestampString + method + savedPath;
                const signature = this.hmac (this.encode (auth), this.encode (this.secret), sha256);
                headers = {
                    'ZKX_ACCESS_KEY': this.apiKey,
                    'ZKX_ACCESS_SIGN': signature,
                    'ZKX_ACCESS_TIMESTAMP': timestampString,
                    'Content-Type': 'application/json',
                };
            }
            if (authorizationString !== undefined) {
                headers = {
                    'Authorization': authorizationString,
                    'Content-Type': 'application/json',
                };
                if (method !== 'GET') {
                    if (Object.keys (query).length) {
                        body = this.json (query);
                    }
                }
            }
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    handleErrors (code: int, reason: string, url: string, method: string, headers: Dict, body: string, response, requestHeaders, requestBody) {
        if (response === undefined) {
            return undefined; // fallback to default error handler
        }
        const feedback = this.id + ' ' + body;
        //
        //
        //    {
        //      "error": {
        //        {
        //          "reason": "Bad Request",
        //          "message": "Order is not cancellable"
        //        }
        //      }
        //    }
        //
        const errorResponse = this.safeDict (response, 'error');
        const errorCode = this.safeString (errorResponse, 'reason');
        if (errorCode !== undefined) {
            const errorMessage = this.safeString (errorResponse, 'message');
            this.throwExactlyMatchedException (this.exceptions['exact'], errorCode, feedback);
            this.throwBroadlyMatchedException (this.exceptions['broad'], errorMessage, feedback);
            throw new ExchangeError (feedback);
        }
        // const errors = this.safeList(response, 'errors');
        // if (errors !== undefined) {
        //     if (Array.isArray(errors)) {
        //         const numErrors = errors.length;
        //         if (numErrors > 0) {
        //             errorCode = this.safeString (errors[0], 'id');
        //             const errorMessage = this.safeString (errors[0], 'message');
        //             if (errorCode !== undefined) {
        //                 this.throwExactlyMatchedException(this.exceptions['exact'], errorCode, feedback);
        //                 this.throwBroadlyMatchedException(this.exceptions['broad'], errorMessage, feedback);
        //                 throw new ExchangeError(feedback);
        //             }
        //         }
        //     }
        // }
        return undefined;
    }
}