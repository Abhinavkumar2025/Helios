========================================================================
HOW TO TEST YOUR OWN IMAGES WITH HELIOS ACCIDENT AI
========================================================================

1. Drop or paste any image(s) (.jpg, .png, .jpeg, etc.) into this folder:
   e:\SIH26\Helios\model_Test_my_image\

2. Open your terminal at project root and run:
   python test_my_images.py

3. What happens:
   - The YOLO accident model processes all your images.
   - It draws bounding boxes and confidence scores directly on the images.
   - Saves all annotated results into the 'results/' folder here:
     e:\SIH26\Helios\model_Test_my_image\results\
   - If an accident is detected, it automatically broadcasts an emergency
     alert to your Helios Web Dashboard (http://localhost:5173/accidents)!
========================================================================
