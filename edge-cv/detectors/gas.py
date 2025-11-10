"""
Gas Level Detector
Uses image processing to detect gas level based on calibration marker
"""

import cv2
import numpy as np
import logging
from typing import Dict, Any

import config

logger = logging.getLogger(__name__)


class GasDetector:
    """Detect gas level using visual marker calibration"""

    def __init__(self):
        self.calibration_version = "v1.0"
        self.marker_x = config.GAS_MARKER_X
        self.marker_y = config.GAS_MARKER_Y
        self.marker_height = config.GAS_MARKER_HEIGHT

    def detect(self, frame: np.ndarray) -> Dict[str, Any]:
        """
        Detect gas level from image

        Returns:
            dict with keys: level_pct, confidence, calibration_version, status
        """
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            # Apply Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)

            # Get region of interest (ROI) around marker
            roi_x = max(0, self.marker_x - 50)
            roi_y = max(0, self.marker_y - self.marker_height)
            roi_w = 100
            roi_h = self.marker_height

            roi = blurred[roi_y:roi_y+roi_h, roi_x:roi_x+roi_w]

            # Apply edge detection
            edges = cv2.Canny(roi, 50, 150)

            # Find contours (looking for the gas level line)
            contours, _ = cv2.findContours(
                edges,
                cv2.RETR_EXTERNAL,
                cv2.CHAIN_APPROX_SIMPLE
            )

            if not contours:
                logger.warning("No contours found in ROI")
                return self._default_result(50.0, 0.3)

            # Find the most prominent horizontal line
            max_contour = max(contours, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(max_contour)

            # Calculate level percentage
            # Assuming marker_height represents 0-100% range
            level_from_top = y + (h / 2)
            level_pct = 100 - (level_from_top / roi_h * 100)

            # Clamp to 0-100
            level_pct = max(0, min(100, level_pct))

            # Confidence based on contour quality
            confidence = min(1.0, cv2.contourArea(max_contour) / (roi_w * roi_h))

            # Determine status based on thresholds
            if level_pct < config.GAS_RED_THRESHOLD:
                status = 'red'
            elif level_pct < config.GAS_YELLOW_THRESHOLD:
                status = 'yellow'
            else:
                status = 'green'

            logger.info(
                f"Gas level detected: {level_pct:.1f}% "
                f"(confidence: {confidence:.2f}, status: {status})"
            )

            return {
                'level_pct': round(level_pct, 2),
                'confidence': round(confidence, 3),
                'calibration_version': self.calibration_version,
                'status': status,
            }

        except Exception as e:
            logger.error(f"Gas detection error: {e}", exc_info=True)
            return self._default_result(50.0, 0.0)

    def _default_result(self, level: float, confidence: float) -> Dict[str, Any]:
        """Return default result when detection fails"""
        return {
            'level_pct': level,
            'confidence': confidence,
            'calibration_version': self.calibration_version,
            'status': 'yellow',
        }
