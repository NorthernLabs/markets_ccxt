from ccxt.base.types import Entry


class ImplicitAPI:
    v1_public_get_system_status = v1PublicGetSystemStatus = Entry('system/status', ['v1', 'public'], 'GET', {'cost': 0})
    v1_private_get_assets_balances = v1PrivateGetAssetsBalances = Entry('assets/balances', ['v1', 'private'], 'GET', {'cost': 0})
    v1_private_get_orders = v1PrivateGetOrders = Entry('orders', ['v1', 'private'], 'GET', {'cost': 0})
    v1_private_get_orders_id = v1PrivateGetOrdersId = Entry('orders/{id}', ['v1', 'private'], 'GET', {'cost': 0})
    v1_private_get_trades = v1PrivateGetTrades = Entry('trades', ['v1', 'private'], 'GET', {'cost': 0})
    v1_private_post_orders = v1PrivatePostOrders = Entry('orders', ['v1', 'private'], 'POST', {'cost': 0})
    v1_private_patch_orders_id_cancel = v1PrivatePatchOrdersIdCancel = Entry('orders/{id}/cancel', ['v1', 'private'], 'PATCH', {'cost': 0})
