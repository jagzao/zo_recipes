"""
Camera capture utilities
"""

import cv2
import numpy as np
import base64
import logging
from typing import Optional, Tuple

import config

logger = logging.getLogger(__name__)


class Camera:
    """Camera interface for capturing images"""

    def __init__(self, camera_index: int = 0):
        self.camera_index = camera_index
        self.cap = None
        self._initialize()

    def _initialize(self):
        """Initialize camera"""
        try:
            self.cap = cv2.VideoCapture(self.camera_index)
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, config.CAPTURE_WIDTH)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, config.CAPTURE_HEIGHT)

            if not self.cap.isOpened():
                raise RuntimeError(f"Failed to open camera {self.camera_index}")

            logger.info(f"Camera {self.camera_index} initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize camera: {e}")
            raise

    def capture(self) -> Optional[np.ndarray]:
        """Capture a single frame"""
        if not self.cap or not self.cap.isOpened():
            logger.warning("Camera not initialized, reinitializing...")
            self._initialize()

        ret, frame = self.cap.read()

        if not ret or frame is None:
            logger.error("Failed to capture frame")
            return None

        return frame

    def generate_thumbnail(
        self,
        frame: np.ndarray,
        max_size: Tuple[int, int] = (320, 240)
    ) -> str:
        """Generate base64-encoded thumbnail"""
        try:
            # Resize image
            height, width = frame.shape[:2]
            scale = min(max_size[0] / width, max_size[1] / height)
            new_width = int(width * scale)
            new_height = int(height * scale)

            thumbnail = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_AREA)

            # Encode as JPEG
            _, buffer = cv2.imencode('.jpg', thumbnail, [cv2.IMWRITE_JPEG_QUALITY, 80])

            # Convert to base64
            thumbnail_b64 = base64.b64encode(buffer).decode('utf-8')

            return thumbnail_b64
        except Exception as e:
            logger.error(f"Failed to generate thumbnail: {e}")
            return ""

    def save_image(self, frame: np.ndarray, filepath: str) -> bool:
        """Save image to disk"""
        try:
            cv2.imwrite(filepath, frame)
            return True
        except Exception as e:
            logger.error(f"Failed to save image: {e}")
            return False

    def release(self):
        """Release camera resources"""
        if self.cap:
            self.cap.release()
            logger.info("Camera released")
