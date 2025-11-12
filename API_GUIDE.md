# KitchenEye API Guide

Complete guide for integrating with the KitchenEye API.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Code Examples](#code-examples)
  - [JavaScript/Node.js](#javascriptnodejs)
  - [Python](#python)
  - [cURL](#curl)
  - [Go](#go)
- [Common Use Cases](#common-use-cases)
- [Edge Device Integration](#edge-device-integration)
- [Webhooks](#webhooks)
- [Best Practices](#best-practices)

---

## Overview

The KitchenEye API is a RESTful API that provides programmatic access to all platform features:

- **Base URL:** `https://your-worker.workers.dev`
- **Protocol:** HTTPS only
- **Format:** JSON
- **Authentication:** JWT Bearer tokens
- **API Version:** 1.0

### Interactive Documentation

Interactive API documentation with **Swagger UI** is available at:
```
https://your-worker.workers.dev/api-docs.html
```

### OpenAPI Specification

Download the complete OpenAPI 3.0 spec:
```
https://your-worker.workers.dev/openapi.yaml
```

---

## Authentication

KitchenEye uses **JWT (JSON Web Tokens)** for authentication. There are two methods to obtain a token:

### Method 1: Sign Up (New Account)

Create a new account and receive a JWT token immediately:

```bash
curl -X POST https://your-worker.workers.dev/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@restaurant.com",
    "tenant_name": "My Restaurant",
    "owner_name": "John Doe"
  }'
```

**Response:**
```json
{
  "message": "Account created. Check your email for login link.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Method 2: Magic Link (Existing Account)

Request a magic link to be sent to your email:

```bash
curl -X POST https://your-worker.workers.dev/api/auth/send-magic-link \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@restaurant.com"
  }'
```

Click the link in your email to receive your JWT token.

### Using Your JWT Token

Include the token in the `Authorization` header for all API requests:

```bash
curl https://your-worker.workers.dev/api/cameras \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Token Verification

Verify your token at any time:

```bash
curl https://your-worker.workers.dev/api/auth/verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "owner@restaurant.com",
    "name": "John Doe",
    "role": "owner",
    "tenant_id": 1
  }
}
```

---

## Rate Limiting

API requests are rate-limited to ensure fair usage:

| Limit Type | Threshold | Window |
|------------|-----------|--------|
| IP-based | 100 requests | per minute |
| Tenant-based | 1000 requests | per hour |
| Camera ingest | 60 requests | per minute |

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

### Handling Rate Limits

When you exceed the rate limit, you'll receive a `429 Too Many Requests` response:

```json
{
  "error": "Rate limit exceeded. Try again in 60 seconds."
}
```

**Best Practice:** Implement exponential backoff:

```javascript
async function callAPIWithBackoff(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || (2 ** i) * 1000;
      await new Promise(resolve => setTimeout(resolve, retryAfter));
      continue;
    }

    return response;
  }

  throw new Error('Max retries exceeded');
}
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Descriptive error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Invalid or missing JWT token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Common Error Codes

```javascript
const ERROR_CODES = {
  INVALID_CREDENTIALS: 'Email not found or invalid token',
  PERMISSION_DENIED: 'Insufficient permissions for this action',
  RESOURCE_NOT_FOUND: 'Requested resource does not exist',
  VALIDATION_ERROR: 'Invalid input parameters',
  RATE_LIMIT_EXCEEDED: 'Too many requests',
  TENANT_LIMIT_EXCEEDED: 'Tenant usage limit exceeded',
};
```

---

## Code Examples

### JavaScript/Node.js

#### Setup

```bash
npm install node-fetch
```

#### Basic Usage

```javascript
const fetch = require('node-fetch');

const API_BASE = 'https://your-worker.workers.dev';
const JWT_TOKEN = 'your-jwt-token';

// Helper function
async function apiCall(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || response.statusText);
  }

  return response.json();
}

// Example: List cameras
async function listCameras() {
  try {
    const data = await apiCall('/api/cameras');
    console.log('Cameras:', data.cameras);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example: Create camera
async function createCamera(cameraData) {
  try {
    const data = await apiCall('/api/cameras', {
      method: 'POST',
      body: JSON.stringify(cameraData),
    });
    console.log('Created:', data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example: Get inventory
async function getInventory(status = 'available') {
  try {
    const data = await apiCall(`/api/inventory?status=${status}`);
    console.log('Inventory:', data.items);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example: Search recipes
async function searchRecipes(query, filters = {}) {
  const params = new URLSearchParams({
    q: query,
    ...filters,
  });

  try {
    const data = await apiCall(`/api/recipes?${params}`);
    console.log('Recipes:', data.recipes);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Usage
listCameras();
createCamera({
  name: 'Kitchen Gas Monitor',
  type: 'gas',
  location: 'Main Kitchen',
  schedule: '*/15 * * * *',
});
getInventory('low');
searchRecipes('pasta', { intent: 'quick', available: true });
```

#### TypeScript with Types

```typescript
interface Camera {
  id: number;
  tenant_id: number;
  name: string;
  type: 'gas' | 'fridge';
  location: string;
  status: 'active' | 'inactive' | 'error';
  schedule: string;
  config: Record<string, any>;
  last_capture_at: string | null;
  created_at: string;
}

interface APIResponse<T> {
  [key: string]: T;
}

class KitchenEyeClient {
  constructor(
    private baseURL: string,
    private token: string
  ) {}

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || response.statusText);
    }

    return response.json();
  }

  async getCameras(): Promise<Camera[]> {
    const data = await this.request<APIResponse<Camera[]>>('/api/cameras');
    return data.cameras;
  }

  async createCamera(camera: Omit<Camera, 'id' | 'tenant_id' | 'created_at'>): Promise<Camera> {
    return this.request<Camera>('/api/cameras', {
      method: 'POST',
      body: JSON.stringify(camera),
    });
  }

  async acknowledgeAlert(alertId: number): Promise<void> {
    await this.request(`/api/notifications/alerts/${alertId}/acknowledge`, {
      method: 'POST',
    });
  }
}

// Usage
const client = new KitchenEyeClient(
  'https://your-worker.workers.dev',
  'your-jwt-token'
);

const cameras = await client.getCameras();
console.log(cameras);
```

---

### Python

#### Setup

```bash
pip install requests
```

#### Basic Usage

```python
import requests
from typing import Dict, List, Optional

API_BASE = 'https://your-worker.workers.dev'
JWT_TOKEN = 'your-jwt-token'

class KitchenEyeClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        })

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict:
        url = f'{self.base_url}{endpoint}'
        response = self.session.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json()

    def list_cameras(self, camera_type: Optional[str] = None) -> List[Dict]:
        params = {'type': camera_type} if camera_type else {}
        data = self._request('GET', '/api/cameras', params=params)
        return data['cameras']

    def create_camera(self, camera: Dict) -> Dict:
        return self._request('POST', '/api/cameras', json=camera)

    def get_inventory(self, status: Optional[str] = None) -> List[Dict]:
        params = {'status': status} if status else {}
        data = self._request('GET', '/api/inventory', params=params)
        return data['items']

    def search_recipes(
        self,
        query: str,
        intent: Optional[str] = None,
        available: bool = False
    ) -> List[Dict]:
        params = {'q': query}
        if intent:
            params['intent'] = intent
        if available:
            params['available'] = 'true'

        data = self._request('GET', '/api/recipes', params=params)
        return data['recipes']

    def acknowledge_alert(self, alert_id: int) -> Dict:
        endpoint = f'/api/notifications/alerts/{alert_id}/acknowledge'
        return self._request('POST', endpoint)

    def generate_report(
        self,
        report_type: str,
        format: str = 'json',
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict:
        payload = {
            'type': report_type,
            'format': format,
        }
        if start_date:
            payload['start_date'] = start_date
        if end_date:
            payload['end_date'] = end_date

        return self._request('POST', '/api/reports/export', json=payload)

# Usage
client = KitchenEyeClient(API_BASE, JWT_TOKEN)

# List all cameras
cameras = client.list_cameras()
print(f'Found {len(cameras)} cameras')

# Create a new camera
new_camera = client.create_camera({
    'name': 'Kitchen Gas Monitor',
    'type': 'gas',
    'location': 'Main Kitchen',
    'schedule': '*/15 * * * *',
})
print(f'Created camera: {new_camera["id"]}')

# Get low inventory items
low_items = client.get_inventory(status='low')
print(f'Low inventory items: {len(low_items)}')

# Search for quick recipes
recipes = client.search_recipes('pasta', intent='quick', available=True)
print(f'Found {len(recipes)} quick pasta recipes')

# Acknowledge an alert
client.acknowledge_alert(123)
print('Alert acknowledged')

# Generate report
report = client.generate_report('missing_items', format='json')
print(f'Missing items report: {report}')
```

---

### cURL

#### Authentication

```bash
# Sign up
curl -X POST https://your-worker.workers.dev/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@restaurant.com","tenant_name":"My Restaurant","owner_name":"John Doe"}'

# Set your token
export JWT_TOKEN="your-jwt-token-here"
```

#### Cameras

```bash
# List cameras
curl https://your-worker.workers.dev/api/cameras \
  -H "Authorization: Bearer $JWT_TOKEN"

# Create camera
curl -X POST https://your-worker.workers.dev/api/cameras \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Kitchen Gas Monitor",
    "type": "gas",
    "location": "Main Kitchen",
    "schedule": "*/15 * * * *"
  }'

# Update camera
curl -X PATCH https://your-worker.workers.dev/api/cameras/1 \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Camera Name"}'

# Delete camera
curl -X DELETE https://your-worker.workers.dev/api/cameras/1 \
  -H "Authorization: Bearer $JWT_TOKEN"
```

#### Inventory

```bash
# Get all inventory
curl https://your-worker.workers.dev/api/inventory \
  -H "Authorization: Bearer $JWT_TOKEN"

# Get low inventory items
curl "https://your-worker.workers.dev/api/inventory?status=low" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Add inventory item
curl -X POST https://your-worker.workers.dev/api/inventory \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tomato",
    "category": "vegetable",
    "quantity": 10,
    "unit": "pieces"
  }'
```

#### Recipes

```bash
# Search recipes
curl "https://your-worker.workers.dev/api/recipes?q=pasta&intent=quick&available=true" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Get specific recipe
curl https://your-worker.workers.dev/api/recipes/1 \
  -H "Authorization: Bearer $JWT_TOKEN"
```

#### Alerts

```bash
# List all alerts
curl https://your-worker.workers.dev/api/notifications/alerts \
  -H "Authorization: Bearer $JWT_TOKEN"

# Filter alerts
curl "https://your-worker.workers.dev/api/notifications/alerts?status=new&severity=high" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Acknowledge alert
curl -X POST https://your-worker.workers.dev/api/notifications/alerts/1/acknowledge \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Go

```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

const (
	APIBase  = "https://your-worker.workers.dev"
	JWTToken = "your-jwt-token"
)

type KitchenEyeClient struct {
	baseURL string
	token   string
	client  *http.Client
}

type Camera struct {
	ID           int                    `json:"id"`
	TenantID     int                    `json:"tenant_id"`
	Name         string                 `json:"name"`
	Type         string                 `json:"type"`
	Location     string                 `json:"location"`
	Status       string                 `json:"status"`
	Schedule     string                 `json:"schedule"`
	Config       map[string]interface{} `json:"config"`
	LastCaptureAt *string               `json:"last_capture_at"`
	CreatedAt    string                 `json:"created_at"`
}

func NewClient(baseURL, token string) *KitchenEyeClient {
	return &KitchenEyeClient{
		baseURL: baseURL,
		token:   token,
		client:  &http.Client{},
	}
}

func (c *KitchenEyeClient) request(method, endpoint string, body interface{}) ([]byte, error) {
	url := c.baseURL + endpoint

	var reqBody io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewBuffer(jsonData)
	}

	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("API error: %s", string(respBody))
	}

	return respBody, nil
}

func (c *KitchenEyeClient) ListCameras() ([]Camera, error) {
	data, err := c.request("GET", "/api/cameras", nil)
	if err != nil {
		return nil, err
	}

	var result struct {
		Cameras []Camera `json:"cameras"`
	}

	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	return result.Cameras, nil
}

func (c *KitchenEyeClient) CreateCamera(camera map[string]interface{}) (*Camera, error) {
	data, err := c.request("POST", "/api/cameras", camera)
	if err != nil {
		return nil, err
	}

	var result Camera
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

func main() {
	client := NewClient(APIBase, JWTToken)

	// List cameras
	cameras, err := client.ListCameras()
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}

	fmt.Printf("Found %d cameras\n", len(cameras))
	for _, camera := range cameras {
		fmt.Printf("- %s (%s) at %s\n", camera.Name, camera.Type, camera.Location)
	}

	// Create camera
	newCamera, err := client.CreateCamera(map[string]interface{}{
		"name":     "Kitchen Gas Monitor",
		"type":     "gas",
		"location": "Main Kitchen",
		"schedule": "*/15 * * * *",
	})

	if err != nil {
		fmt.Printf("Error creating camera: %v\n", err)
		return
	}

	fmt.Printf("Created camera: %d\n", newCamera.ID)
}
```

---

## Common Use Cases

### 1. Monitor Gas Levels

```python
def check_gas_levels(client):
    # Get all gas cameras
    cameras = client.list_cameras(camera_type='gas')

    for camera in cameras:
        # Get recent status
        status = client.get_camera_status(camera['id'])

        # Check if level is low
        if status.get('gas_level', 100) < 20:
            print(f'⚠️ Low gas level at {camera["location"]}: {status["gas_level"]}%')

            # Get related alerts
            alerts = client.list_alerts(camera_id=camera['id'], status='new')
            print(f'Found {len(alerts)} unacknowledged alerts')
```

### 2. Generate Shopping List

```javascript
async function generateShoppingList(client) {
  // Get missing items report
  const report = await client.generateReport({
    type: 'missing_items',
    format: 'json',
  });

  // Get low inventory items
  const lowItems = await client.getInventory('low');

  // Combine into shopping list
  const shoppingList = [
    ...report.missing_items.map(item => item.name),
    ...lowItems.map(item => item.name),
  ];

  console.log('Shopping List:');
  shoppingList.forEach((item, i) => {
    console.log(`${i + 1}. ${item}`);
  });

  return shoppingList;
}
```

### 3. Daily Digest Email

```python
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta

def send_daily_digest(client, recipient_email):
    # Get today's alerts
    today = datetime.now().date()
    alerts = client.list_alerts(
        start_date=today.isoformat(),
        severity='high',
    )

    # Get inventory status
    low_items = client.get_inventory(status='low')
    out_items = client.get_inventory(status='out')

    # Generate email content
    content = f"""
    Daily Kitchen Digest - {today}

    Alerts: {len(alerts)} high-priority alerts
    Inventory:
    - Low stock: {len(low_items)} items
    - Out of stock: {len(out_items)} items

    Low Stock Items:
    {chr(10).join(f'- {item["name"]}: {item["quantity"]} {item["unit"]}' for item in low_items)}
    """

    # Send email
    msg = MIMEText(content)
    msg['Subject'] = f'Kitchen Digest - {today}'
    msg['From'] = 'noreply@kitcheneye.com'
    msg['To'] = recipient_email

    # Send via SMTP...
```

---

## Edge Device Integration

For integrating edge CV devices (Raspberry Pi, etc.) with HMAC authentication:

### Python Example

```python
import hmac
import hashlib
import json
import requests
from datetime import datetime

class EdgeDevice:
    def __init__(self, api_base, camera_id, camera_secret):
        self.api_base = api_base
        self.camera_id = camera_id
        self.camera_secret = camera_secret

    def _sign_payload(self, payload):
        """Generate HMAC-SHA256 signature"""
        payload_str = json.dumps(payload, separators=(',', ':'))
        signature = hmac.new(
            self.camera_secret.encode(),
            payload_str.encode(),
            hashlib.sha256
        ).hexdigest()
        return signature

    def send_data(self, data_type, data, image_url=None):
        """Send data to KitchenEye API"""
        payload = {
            'camera_id': self.camera_id,
            'type': data_type,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'data': data,
        }

        if image_url:
            payload['image_url'] = image_url

        # Generate signature
        signature = self._sign_payload(payload)

        # Send request
        response = requests.post(
            f'{self.api_base}/api/ingest',
            json=payload,
            headers={'X-Signature': signature}
        )

        response.raise_for_status()
        return response.json()

# Usage
device = EdgeDevice(
    api_base='https://your-worker.workers.dev',
    camera_id=1,
    camera_secret='your-camera-secret'
)

# Send gas level data
result = device.send_data(
    data_type='gas_level',
    data={
        'level': 45.5,
        'confidence': 0.92,
    },
    image_url='https://r2.example.com/capture-123.jpg'
)

print('Data ingested:', result)
```

---

## Best Practices

### 1. Use Environment Variables

Never hardcode tokens in your code:

```bash
# .env file
KITCHENEYE_API_BASE=https://your-worker.workers.dev
KITCHENEYE_JWT_TOKEN=your-jwt-token
```

```javascript
require('dotenv').config();

const API_BASE = process.env.KITCHENEYE_API_BASE;
const JWT_TOKEN = process.env.KITCHENEYE_JWT_TOKEN;
```

### 2. Implement Retry Logic

```javascript
async function apiCallWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      if (error.response?.status === 429) {
        // Rate limited - wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
      } else {
        throw error; // Don't retry on other errors
      }
    }
  }
}
```

### 3. Cache Responses

```javascript
const cache = new Map();

async function getCachedData(key, fetchFn, ttl = 60000) {
  const cached = cache.get(key);

  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  const data = await fetchFn();
  cache.set(key, { data, timestamp: Date.now() });

  return data;
}

// Usage
const cameras = await getCachedData('cameras', () => client.getCameras());
```

### 4. Monitor Rate Limits

```javascript
class RateLimitedClient {
  constructor(baseClient) {
    this.client = baseClient;
    this.remaining = 100;
    this.reset = Date.now() + 60000;
  }

  async request(fn) {
    if (this.remaining < 10 && Date.now() < this.reset) {
      console.warn('Approaching rate limit, slowing down...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const result = await fn();

    // Update rate limit info from response headers
    this.remaining = parseInt(result.headers.get('X-RateLimit-Remaining') || '100');
    this.reset = parseInt(result.headers.get('X-RateLimit-Reset') || Date.now() + 60000);

    return result;
  }
}
```

### 5. Handle Errors Gracefully

```python
from requests.exceptions import HTTPError, Timeout, ConnectionError

def safe_api_call(client_method, *args, **kwargs):
    try:
        return client_method(*args, **kwargs)
    except HTTPError as e:
        if e.response.status_code == 401:
            print('Authentication failed. Please check your token.')
        elif e.response.status_code == 429:
            print('Rate limit exceeded. Please wait before retrying.')
        elif e.response.status_code >= 500:
            print('Server error. Please try again later.')
        else:
            print(f'API error: {e}')
        return None
    except (Timeout, ConnectionError) as e:
        print(f'Connection error: {e}')
        return None
    except Exception as e:
        print(f'Unexpected error: {e}')
        return None
```

---

## Support

- **Documentation:** https://your-worker.workers.dev/api-docs.html
- **GitHub:** https://github.com/your-org/kitcheneye
- **Email:** support@kitcheneye.com

---

*Last updated: 2025-11-12*
