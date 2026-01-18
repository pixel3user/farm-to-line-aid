# Yamato API Postman Tests (excluding /logistics/yamato/config and /logistics/yamato/resolve-zip)

## Setup
- Set a Postman environment variable `apiBaseUrl` to the same base you used for the config and resolve-zip tests.
  - Routes are mounted at both `/api` and `/`, so keep using the base that already works for you.
- Optional variables for convenience: `orderId`, `fileNo`, `obtNumber`, `receiveStoreId`.
- Use header `Content-Type: application/json`.
- These endpoints rely on server-side Yamato credentials (`YAMATO_CUSTOMER_ID`, `YAMATO_CUSTOMER_TOKEN`).
- Order-scoped endpoints require an existing order with shipping data in Firestore.
  - If you set `splitBySeller: true`, products must have pickup address + `yamatoZipCode`.

## Common response expectations
- Success: HTTP 200 with `IsOK: "Y"` and a Yamato `Message`.
- Yamato validation failure: HTTP 400 with `IsOK: "N"`.
- Server/config error: HTTP 500 with `{ "error": "..." }`.

## Direct Yamato proxy endpoints

### POST /logistics/yamato/parse-address
Description: Proxies Yamato ParsingAddress to normalize an address.

Example request:
```json
{
  "PostType": "01",
  "Addresses": [
    { "Search": "Taipei City Da'an District Xinyi Rd Sec 4 No. 1" }
  ]
}
```

Expected:
- `IsOK: "Y"` and `Data.Addresses` populated when the address is found.

Notes:
- Use this when you want raw Yamato address parsing, not just zip extraction.

### POST /logistics/yamato/print-obt
Description: Prints standard OBT (shipping label) via Yamato PrintOBT.

Example request:
```json
{
  "PrintType": "01",
  "PrintOBTType": "01",
  "Orders": [
    {
      "OrderId": "ORDER-1001",
      "OBTNumber": "",
      "Thermosphere": "0001",
      "Spec": "0001",
      "RecipientName": "Test Recipient",
      "RecipientTel": "0223456789",
      "RecipientMobile": "0912345678",
      "RecipientAddress": "Taipei City Da'an District Xinyi Rd Sec 4 No. 1",
      "ReceiptLocation": "01",
      "ReceiptStationNo": "",
      "SenderName": "Test Sender",
      "SenderTel": "0223451111",
      "SenderMobile": "",
      "SenderZipCode": "100001",
      "SenderAddress": "Taipei City Zhongzheng District Zhonghua Rd No. 1",
      "ShipmentDate": "20241203",
      "DeliveryDate": "20241204",
      "DeliveryTime": "04",
      "IsFreight": "N",
      "IsCollection": "N",
      "ProductName": "Sample Box",
      "ProductTypeId": "0015",
      "CollectionAmount": 0,
      "IsSwipe": "N",
      "IsDeclare": "N"
    }
  ]
}
```

Expected:
- `IsOK: "Y"` with `Data.FileNo` and `Data.Orders[*].OBTNumber`.

Notes:
- Required by Yamato for PrintOBT: `PrintType`, `PrintOBTType`, and per-order
  `Thermosphere`, `Spec`, `ShipmentDate`, `DeliveryDate`, `DeliveryTime`,
  `IsFreight`, `IsCollection`, `IsSwipe`, `IsDeclare`.
- Date format for `ShipmentDate`/`DeliveryDate` is `YYYYMMDD` (per Yamato spec).

### POST /logistics/yamato/print-obt-picking-list
Description: Prints OBT using the picking list flow.

Example request:
```json
{
  "PrintType": "01",
  "PrintOBTType": "01",
  "Orders": [
    {
      "OrderId": "ORDER-2001",
      "OBTNumber": "",
      "Thermosphere": "0002",
      "Spec": "0002",
      "RecipientName": "Test Recipient",
      "RecipientTel": "0223456789",
      "RecipientMobile": "0912345678",
      "RecipientAddress": "Taipei City Songshan District Minsheng E Rd Sec 4 No. 10",
      "ReceiptLocation": "01",
      "ReceiptStationNo": "",
      "SenderName": "Test Sender",
      "SenderTel": "0223451111",
      "SenderMobile": "",
      "SenderZipCode": "105001",
      "SenderAddress": "Taipei City Songshan District Nanjing E Rd No. 1",
      "ShipmentDate": "20241213",
      "DeliveryDate": "20241214",
      "DeliveryTime": "02",
      "IsFreight": "N",
      "IsCollection": "Y",
      "ProductName": "Sample Box",
      "ProductTypeId": "0015",
      "CollectionAmount": 600,
      "IsSwipe": "N",
      "IsDeclare": "N"
    }
  ]
}
```

Expected:
- `IsOK: "Y"` with `Data.FileNo` and `Data.Orders[*].OBTNumber`.

### POST /logistics/yamato/print-obt-b2s
Description: Prints OBT for B2S (store pickup) shipments.

Example request:
```json
{
  "PrintType": "01",
  "PrintOBTType": "01",
  "Orders": [
    {
      "OrderId": "ORDER-3001",
      "OBTNumber": "",
      "Thermosphere": "0002",
      "Spec": "0002",
      "ReceiveStoreId": "123456",
      "RecipientName": "Test Recipient",
      "RecipientTel": "0223456789",
      "RecipientMobile": "0912345678",
      "SenderName": "Test Sender",
      "SenderTel": "0223451111",
      "SenderMobile": "",
      "SenderZipCode": "100001",
      "SenderAddress": "Taipei City Zhongzheng District Zhonghua Rd No. 1",
      "IsCollection": "Y",
      "CollectionAmount": 500
    }
  ]
}
```

Expected:
- `IsOK: "Y"` with `Data.FileNo` and `Data.Orders[*].OBTNumber`.

Notes:
- `ReceiveStoreId` is required for B2S.

### POST /logistics/yamato/download-obt
Description: Downloads a PDF label (or returns JSON error) for a file number.

Example request:
```json
{
  "FileNo": "{{fileNo}}"
}
```

Expected:
- If successful, binary PDF data with `Content-Type: application/pdf`.
- If Yamato rejects it, JSON with `IsOK: "N"`.

Notes:
- Use Postman "Send and Download" for the file response.
- Get `FileNo` from a successful PrintOBT response.

### POST /logistics/yamato/call
Description: Requests a pickup via Yamato Call service.

Example request:
```json
{
  "CustomerName": "Test Sender",
  "ContactName": "Test Sender",
  "ContactAddress": "Taipei City Zhongzheng District Zhonghua Rd No. 1",
  "ContactTelArea": "02",
  "ContactTelNumber": "23456789",
  "ContactTelExt": "",
  "ContactMobile": "0912345678",
  "Piece": 1,
  "Weight": 1
}
```

Expected:
- `IsOK: "Y"` with `SrvTranId` and `Message`.

Notes:
- Add any additional fields required by your Yamato contract (pickup time window, item type, etc).

### POST /logistics/yamato/reserve-add
Description: Creates a pickup reservation (ReserveAdd).

Example request:
```json
{
  "ReserveDate": "2024-12-25",
  "ReserveTime": "14:00-18:00",
  "CustomerName": "Test Sender",
  "ContactName": "Test Sender",
  "ContactAddress": "Taipei City Zhongzheng District Zhonghua Rd No. 1",
  "ContactTelArea": "02",
  "ContactTelNumber": "23456789",
  "ContactTelExt": "",
  "ContactMobile": "0912345678",
  "Piece": 1,
  "Weight": 1
}
```

Expected:
- `IsOK: "Y"` with a reservation reference (see Yamato response fields).

Notes:
- Confirm exact field requirements in the Yamato API spec.

### POST /logistics/yamato/reserve-edit
Description: Updates a pickup reservation (ReserveEdit).

Example request:
```json
{
  "ReserveNo": "{{reserveNo}}",
  "ReserveDate": "2024-12-26",
  "ReserveTime": "10:00-12:00",
  "ContactName": "Test Sender",
  "ContactMobile": "0912345678"
}
```

Expected:
- `IsOK: "Y"` when the reservation is updated.

Notes:
- Use the reservation number returned by ReserveAdd.

### POST /logistics/yamato/reserve-delete
Description: Cancels a pickup reservation (ReserveDelete).

Example request:
```json
{
  "ReserveNo": "{{reserveNo}}"
}
```

Expected:
- `IsOK: "Y"` when the reservation is cancelled.

### POST /logistics/yamato/reserve-query
Description: Queries a pickup reservation (ReserveQuery).

Example request:
```json
{
  "ReserveNo": "{{reserveNo}}"
}
```

Expected:
- `IsOK: "Y"` with reservation details in `Data`.

### POST /logistics/yamato/obt-status
Description: Queries shipment status by OBT numbers.

Example request:
```json
{
  "OBTNumbers": ["{{obtNumber}}"]
}
```

Expected:
- `IsOK: "Y"` with status details in `Data.OBTs`.

## Order-scoped Yamato endpoints

### POST /orders/:orderId/logistics/yamato/print-obt
Description: Prints OBT using order shipping data and records shipment in Firestore.

Example request:
```json
{
  "PrintType": "01",
  "PrintOBTType": "01",
  "Orders": [
    {
      "OrderId": "{{orderId}}",
      "OBTNumber": "",
      "Thermosphere": "0001",
      "Spec": "0001",
      "ShipmentDate": "20241203",
      "DeliveryDate": "20241204",
      "DeliveryTime": "04",
      "IsFreight": "N",
      "IsCollection": "N",
      "CollectionAmount": 0,
      "IsSwipe": "N",
      "IsDeclare": "N"
    }
  ],
  "senderName": "Test Sender",
  "senderTel": "02-23456789",
  "senderMobile": "0912345678",
  "senderZipCode": "100001",
  "senderAddress": "Taipei City Zhongzheng District Zhonghua Rd No. 1"
}
```

Expected:
- `IsOK: "Y"` with `Data.FileNo` and `Data.Orders[*].OBTNumber`.

Notes:
- Sender fields are required if any Orders entry lacks sender data.
- Order must have shipping name/address, or you must pass `recipientName` and `recipientAddress`.

### POST /orders/:orderId/logistics/yamato/print-obt-picking-list
Description: Prints OBT by picking list using order data and records shipment.

Example request:
```json
{
  "PrintType": "01",
  "PrintOBTType": "01",
  "Orders": [
    {
      "OrderId": "{{orderId}}",
      "OBTNumber": "",
      "Thermosphere": "0002",
      "Spec": "0002",
      "ShipmentDate": "20241213",
      "DeliveryDate": "20241214",
      "DeliveryTime": "02",
      "IsFreight": "N",
      "IsCollection": "Y",
      "CollectionAmount": 600,
      "IsSwipe": "N",
      "IsDeclare": "N"
    }
  ],
  "senderName": "Test Sender",
  "senderTel": "02-23456789",
  "senderMobile": "0912345678",
  "senderZipCode": "100001",
  "senderAddress": "Taipei City Zhongzheng District Zhonghua Rd No. 1"
}
```

Expected:
- `IsOK: "Y"` with `Data.FileNo` and `Data.Orders[*].OBTNumber`.

### POST /orders/:orderId/logistics/yamato/print-obt-b2s
Description: Prints B2S label using order data and records shipment.

Example request:
```json
{
  "PrintType": "01",
  "PrintOBTType": "01",
  "receiveStoreId": "{{receiveStoreId}}",
  "Orders": [
    {
      "OrderId": "{{orderId}}",
      "OBTNumber": "",
      "Thermosphere": "0002",
      "Spec": "0002",
      "IsCollection": "Y",
      "CollectionAmount": 500
    }
  ],
  "senderName": "Test Sender",
  "senderTel": "02-23456789",
  "senderMobile": "0912345678",
  "senderZipCode": "100001",
  "senderAddress": "Taipei City Zhongzheng District Zhonghua Rd No. 1"
}
```

Expected:
- `IsOK: "Y"` with `Data.FileNo` and `Data.Orders[*].OBTNumber`.

Notes:
- `receiveStoreId` is required if the order does not already have `shipping.storeId`.

### POST /orders/:orderId/logistics/yamato/pickup
Description: Requests a pickup for the order and records pickup details.

Example request (splitBySeller false):
```json
{
  "CustomerName": "Test Sender",
  "ContactName": "Test Sender",
  "ContactAddress": "Taipei City Zhongzheng District Zhonghua Rd No. 1",
  "ContactTelArea": "02",
  "ContactTelNumber": "23456789",
  "ContactTelExt": "",
  "ContactMobile": "0912345678"
}
```

Expected:
- `IsOK: "Y"` with `SrvTranId` and `Message`.

Notes:
- For multi-seller pickup, set `splitBySeller: true` and optionally filter with `sellerId` or `sellerIds`.

### POST /orders/:orderId/logistics/yamato/obt-status
Description: Queries status for the order's OBT numbers and records tracking data.

Example request:
```json
{
  "OBTNumbers": ["{{obtNumber}}"]
}
```

Expected:
- `IsOK: "Y"` with `Data.OBTs` status list.
