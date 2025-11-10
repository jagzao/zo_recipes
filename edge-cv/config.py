"""
KitchenEye Edge CV Configuration
"""

import os
from dotenv import load_dotenv

load_dotenv()

# API Configuration
API_BASE_URL = os.getenv('API_BASE_URL', 'https://api.kitcheneye.com')
CAMERA_ID = os.getenv('CAMERA_ID', '')
CAMERA_TYPE = os.getenv('CAMERA_TYPE', 'gas')  # gas or fridge
DEVICE_ID = os.getenv('DEVICE_ID', 'edge-001')

# Camera Configuration
CAMERA_INDEX = int(os.getenv('CAMERA_INDEX', '0'))
CAPTURE_WIDTH = int(os.getenv('CAPTURE_WIDTH', '1280'))
CAPTURE_HEIGHT = int(os.getenv('CAPTURE_HEIGHT', '720'))

# Gas Detection Configuration
GAS_MARKER_X = int(os.getenv('GAS_MARKER_X', '640'))
GAS_MARKER_Y = int(os.getenv('GAS_MARKER_Y', '360'))
GAS_MARKER_HEIGHT = int(os.getenv('GAS_MARKER_HEIGHT', '500'))
GAS_RED_THRESHOLD = float(os.getenv('GAS_RED_THRESHOLD', '15'))
GAS_YELLOW_THRESHOLD = float(os.getenv('GAS_YELLOW_THRESHOLD', '35'))

# Fridge Detection Configuration
FRIDGE_MODEL_PATH = os.getenv('FRIDGE_MODEL_PATH', './models/yolov5n.onnx')
FRIDGE_CONFIDENCE_THRESHOLD = float(os.getenv('FRIDGE_CONFIDENCE_THRESHOLD', '0.4'))
FRIDGE_NMS_THRESHOLD = float(os.getenv('FRIDGE_NMS_THRESHOLD', '0.5'))

# Schedule Configuration
GAS_SCHEDULE_TIME = os.getenv('GAS_SCHEDULE_TIME', '05:00')  # HH:MM format
FRIDGE_SCHEDULE_INTERVAL = int(os.getenv('FRIDGE_SCHEDULE_INTERVAL', '4'))  # hours

# Storage Configuration
STORE_IMAGES_LOCALLY = os.getenv('STORE_IMAGES_LOCALLY', 'false').lower() == 'true'
LOCAL_IMAGE_PATH = os.getenv('LOCAL_IMAGE_PATH', './captures')
SEND_THUMBNAILS = os.getenv('SEND_THUMBNAILS', 'true').lower() == 'true'

# Retry Configuration
MAX_RETRIES = int(os.getenv('MAX_RETRIES', '3'))
RETRY_DELAY = int(os.getenv('RETRY_DELAY', '5'))  # seconds

# Logging
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
