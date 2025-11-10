"""
KitchenEye Edge CV - Main Entry Point
Runs CV detection and sends results to the API
"""

import logging
import time
import schedule
from datetime import datetime
from pathlib import Path

import config
from camera import Camera
from detectors.gas import GasDetector
from detectors.fridge import FridgeDetector
from api_client import APIClient

# Setup logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class EdgeCV:
    """Main Edge CV application"""

    def __init__(self):
        self.camera = Camera(config.CAMERA_INDEX)
        self.api_client = APIClient(config.API_BASE_URL, config.CAMERA_ID)

        # Initialize detector based on camera type
        if config.CAMERA_TYPE == 'gas':
            self.detector = GasDetector()
            logger.info(f"Initialized Gas Detector - Schedule: {config.GAS_SCHEDULE_TIME}")
        elif config.CAMERA_TYPE == 'fridge':
            self.detector = FridgeDetector(config.FRIDGE_MODEL_PATH)
            logger.info(f"Initialized Fridge Detector - Interval: {config.FRIDGE_SCHEDULE_INTERVAL}h")
        else:
            raise ValueError(f"Unknown camera type: {config.CAMERA_TYPE}")

        # Create local storage if enabled
        if config.STORE_IMAGES_LOCALLY:
            Path(config.LOCAL_IMAGE_PATH).mkdir(parents=True, exist_ok=True)

    def capture_and_process(self):
        """Capture image and run detection"""
        try:
            logger.info(f"Starting capture for camera {config.CAMERA_ID} ({config.CAMERA_TYPE})")

            # Capture image
            frame = self.camera.capture()
            if frame is None:
                logger.error("Failed to capture image")
                return

            logger.info(f"Image captured: {frame.shape}")

            # Run detection
            result = self.detector.detect(frame)
            logger.info(f"Detection result: {result}")

            # Generate thumbnail if enabled
            thumbnail = None
            if config.SEND_THUMBNAILS:
                thumbnail = self.camera.generate_thumbnail(frame, max_size=(320, 240))

            # Save locally if enabled
            if config.STORE_IMAGES_LOCALLY:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"{config.CAMERA_TYPE}_{timestamp}.jpg"
                filepath = Path(config.LOCAL_IMAGE_PATH) / filename
                self.camera.save_image(frame, str(filepath))
                logger.info(f"Image saved to {filepath}")

            # Send to API
            success = self.api_client.send_result(
                camera_type=config.CAMERA_TYPE,
                result=result,
                thumbnail=thumbnail
            )

            if success:
                logger.info("Result sent successfully")
            else:
                logger.error("Failed to send result")

        except Exception as e:
            logger.error(f"Error in capture_and_process: {e}", exc_info=True)

    def send_health_check(self):
        """Send health check to API"""
        try:
            logger.debug("Sending health check")
            self.api_client.send_health_check('ok')
        except Exception as e:
            logger.error(f"Failed to send health check: {e}")
            self.api_client.send_health_check('error', {'error': str(e)})

    def setup_schedule(self):
        """Setup capture schedule based on camera type"""
        if config.CAMERA_TYPE == 'gas':
            # Gas: capture once daily at specified time
            schedule.every().day.at(config.GAS_SCHEDULE_TIME).do(self.capture_and_process)
            logger.info(f"Gas capture scheduled daily at {config.GAS_SCHEDULE_TIME}")
        elif config.CAMERA_TYPE == 'fridge':
            # Fridge: capture every N hours
            schedule.every(config.FRIDGE_SCHEDULE_INTERVAL).hours.do(self.capture_and_process)
            logger.info(f"Fridge capture scheduled every {config.FRIDGE_SCHEDULE_INTERVAL} hours")

        # Health check every 30 minutes
        schedule.every(30).minutes.do(self.send_health_check)

    def run(self):
        """Main run loop"""
        logger.info("KitchenEye Edge CV starting...")
        logger.info(f"Camera ID: {config.CAMERA_ID}")
        logger.info(f"Camera Type: {config.CAMERA_TYPE}")
        logger.info(f"API: {config.API_BASE_URL}")

        # Setup schedule
        self.setup_schedule()

        # Send initial health check
        self.send_health_check()

        # Run one capture immediately for testing
        logger.info("Running initial capture...")
        self.capture_and_process()

        # Main loop
        logger.info("Entering main loop...")
        while True:
            try:
                schedule.run_pending()
                time.sleep(1)
            except KeyboardInterrupt:
                logger.info("Shutting down...")
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}", exc_info=True)
                time.sleep(10)

        # Cleanup
        self.camera.release()
        logger.info("Edge CV stopped")


if __name__ == '__main__':
    app = EdgeCV()
    app.run()
