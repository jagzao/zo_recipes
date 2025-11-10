"""
API Client for sending detection results to KitchenEye backend
"""

import logging
import time
import uuid
from typing import Dict, Any, Optional
import requests

import config

logger = logging.getLogger(__name__)


class APIClient:
    """Client for communicating with KitchenEye API"""

    def __init__(self, base_url: str, camera_id: str):
        self.base_url = base_url.rstrip('/')
        self.camera_id = camera_id
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': f'KitchenEye-EdgeCV/{config.DEVICE_ID}',
        })

    def send_result(
        self,
        camera_type: str,
        result: Dict[str, Any],
        thumbnail: Optional[str] = None
    ) -> bool:
        """
        Send detection result to API

        Args:
            camera_type: 'gas' or 'fridge'
            result: Detection result dictionary
            thumbnail: Base64-encoded thumbnail (optional)

        Returns:
            True if successful, False otherwise
        """
        message_id = str(uuid.uuid4())

        payload = {
            'message_id': message_id,
            'camera_id': self.camera_id,
            'captured_at': int(time.time()),
            'type': camera_type,
            'results': result,
            'metadata': {
                'device_id': config.DEVICE_ID,
                'firmware_version': '1.0.0',
                'cv_model_version': '1.0.0',
            },
        }

        if thumbnail:
            payload['thumbnail'] = thumbnail

        # Retry logic
        for attempt in range(config.MAX_RETRIES):
            try:
                response = self.session.post(
                    f'{self.base_url}/api/ingest/result',
                    json=payload,
                    timeout=30
                )

                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        logger.info(f"Result sent successfully (message_id: {message_id})")
                        return True
                    else:
                        logger.error(f"API returned error: {data.get('error')}")
                else:
                    logger.error(f"API returned status {response.status_code}: {response.text}")

            except requests.exceptions.RequestException as e:
                logger.error(f"Request failed (attempt {attempt + 1}/{config.MAX_RETRIES}): {e}")

            # Wait before retry
            if attempt < config.MAX_RETRIES - 1:
                time.sleep(config.RETRY_DELAY * (attempt + 1))

        logger.error(f"Failed to send result after {config.MAX_RETRIES} attempts")
        return False

    def send_health_check(self, status: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """
        Send health check to API

        Args:
            status: 'ok' or 'error'
            metadata: Additional metadata (optional)

        Returns:
            True if successful, False otherwise
        """
        payload = {
            'camera_id': self.camera_id,
            'status': status,
            'metadata': metadata or {},
        }

        try:
            response = self.session.post(
                f'{self.base_url}/api/ingest/health',
                json=payload,
                timeout=10
            )

            if response.status_code == 200:
                return True
            else:
                logger.warning(f"Health check failed: {response.status_code}")
                return False

        except requests.exceptions.RequestException as e:
            logger.warning(f"Health check request failed: {e}")
            return False
