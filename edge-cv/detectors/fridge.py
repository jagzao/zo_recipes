"""
Fridge Inventory Detector
Uses YOLO-based object detection to identify food items
"""

import cv2
import numpy as np
import logging
from typing import Dict, Any, List

import config

logger = logging.getLogger(__name__)

# COCO class names (subset relevant to food items)
FOOD_CLASSES = {
    46: 'banana',
    47: 'apple',
    48: 'sandwich',
    49: 'orange',
    50: 'broccoli',
    51: 'carrot',
    52: 'hot dog',
    53: 'pizza',
    54: 'donut',
    55: 'cake',
    56: 'bottle',
}


class FridgeDetector:
    """Detect food items in fridge using YOLO"""

    def __init__(self, model_path: str):
        self.model_path = model_path
        self.confidence_threshold = config.FRIDGE_CONFIDENCE_THRESHOLD
        self.nms_threshold = config.FRIDGE_NMS_THRESHOLD

        # For MVP, we'll use a simplified detection approach
        # In production, you would load an ONNX model here
        logger.info(f"Fridge detector initialized (model: {model_path})")

    def detect(self, frame: np.ndarray) -> Dict[str, Any]:
        """
        Detect food items in the image

        Returns:
            dict with keys: detections (list), total_items, confidence
        """
        try:
            # For MVP, we'll use color-based detection as a placeholder
            # In production, replace this with actual YOLO ONNX inference
            detections = self._simple_color_detection(frame)

            overall_confidence = (
                sum(d['confidence'] for d in detections) / len(detections)
                if detections else 0.0
            )

            logger.info(f"Fridge detection: {len(detections)} items (confidence: {overall_confidence:.2f})")

            return {
                'detections': detections,
                'total_items': len(detections),
                'confidence': round(overall_confidence, 3),
            }

        except Exception as e:
            logger.error(f"Fridge detection error: {e}", exc_info=True)
            return {
                'detections': [],
                'total_items': 0,
                'confidence': 0.0,
            }

    def _simple_color_detection(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Simple color-based detection for MVP
        In production, replace with actual YOLO inference
        """
        detections = []

        # Convert to HSV for color detection
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

        # Define color ranges for common food items
        color_ranges = {
            'banana': ((20, 100, 100), (30, 255, 255)),  # Yellow
            'orange': ((5, 150, 150), (15, 255, 255)),   # Orange
            'apple': ((0, 100, 100), (10, 255, 255)),    # Red
            'broccoli': ((40, 40, 40), (80, 255, 255)),  # Green
            'carrot': ((10, 100, 100), (20, 255, 255)),  # Orange
        }

        for item_name, (lower, upper) in color_ranges.items():
            # Create mask for this color range
            mask = cv2.inRange(hsv, np.array(lower), np.array(upper))

            # Find contours
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            # Filter significant contours
            for contour in contours:
                area = cv2.contourArea(contour)
                if area > 500:  # Minimum area threshold
                    x, y, w, h = cv2.boundingRect(contour)

                    # Determine presence level based on size
                    if area > 5000:
                        present = 2  # Present
                    elif area > 2000:
                        present = 1  # Low
                    else:
                        present = 0  # Absent

                    confidence = min(1.0, area / 10000)

                    detections.append({
                        'item_name': item_name,
                        'present': present,
                        'confidence': round(confidence, 3),
                        'bounding_box': {
                            'x': int(x),
                            'y': int(y),
                            'width': int(w),
                            'height': int(h),
                        },
                    })

        return detections[:10]  # Limit to 10 detections
