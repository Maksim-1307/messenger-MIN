#!/bin/bash

BASE_URL="http://localhost/app-api/notifications"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Тест эндпоинтов уведомлений ===${NC}\n"

# --- 1. Получить публичный VAPID ключ ---
echo -e "${YELLOW}[1] GET /vapid-public-key${NC}"
VAPID_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/vapid-public-key")
HTTP_STATUS=$(echo "$VAPID_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$VAPID_RESPONSE" | sed '/HTTP_STATUS/d')

echo "Status: $HTTP_STATUS"
echo "Body:   $BODY"
echo ""

# --- 2. Подписаться (subscribe) ---
echo -e "${YELLOW}[2] POST /subscribe${NC}"
SUBSCRIBE_PAYLOAD='{
  "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint-123",
  "expirationTime": null,
  "keys": {
    "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
    "auth": "tBHItJI5svbpez7KI4CCXg"
  }
}'

SUB_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$BASE_URL/subscribe" \
  -H "Content-Type: application/json" \
  -d "$SUBSCRIBE_PAYLOAD")

HTTP_STATUS=$(echo "$SUB_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$SUB_RESPONSE" | sed '/HTTP_STATUS/d')

echo "Status: $HTTP_STATUS"
echo "Body:   $BODY"

if [ "$HTTP_STATUS" = "201" ]; then
  echo -e "${GREEN}✓ Подписка успешно сохранена${NC}"
else
  echo -e "${RED}✗ Ошибка подписки${NC}"
fi
echo ""

# --- 3. Проверить подписку (verify) ---
echo -e "${YELLOW}[3] POST /verify (отправляем body, хотя это GET)${NC}"
VERIFY_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$BASE_URL/verify" \
  -H "Content-Type: application/json" \
  -d "$SUBSCRIBE_PAYLOAD")

HTTP_STATUS=$(echo "$VERIFY_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$VERIFY_RESPONSE" | sed '/HTTP_STATUS/d')

echo "Status: $HTTP_STATUS"
echo "Body:   $BODY"

if echo "$BODY" | grep -q '"status":"ok"'; then
  echo -e "${GREEN}✓ Подписка найдена${NC}"
else
  echo -e "${RED}✗ Подписка НЕ найдена (ожидаемо из-за бага с 'in')${NC}"
fi
echo ""

# --- 4. Отправить уведомление ---
echo -e "${YELLOW}[4] POST /send-notification${NC}"
SEND_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$BASE_URL/send-notification" \
  -H "Content-Type: application/json" \
  -d '{"title":"Тест","message":"Привет из curl"}')

HTTP_STATUS=$(echo "$SEND_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$SEND_RESPONSE" | sed '/HTTP_STATUS/d')

echo "Status: $HTTP_STATUS"
echo "Body:   $BODY"
echo ""

echo -e "${YELLOW}=== Тест завершён ===${NC}"