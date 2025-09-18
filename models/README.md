# Dlib Model Files

## Required Files

You need to download the dlib 68 face landmarks model file:

### shape_predictor_68_face_landmarks.dat

**Download from:**
- Official dlib website: http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2
- Or from: https://github.com/davisking/dlib-models/raw/master/shape_predictor_68_face_landmarks.dat.bz2

**Installation:**
1. Download the `.bz2` file
2. Extract it to get `shape_predictor_68_face_landmarks.dat`
3. Place the extracted file in this `models/` directory

**File size:** ~95MB (compressed: ~60MB)

## Alternative Models

You can also use other face landmark models:
- `shape_predictor_5_face_landmarks.dat` (smaller, less accurate)
- `shape_predictor_68_face_landmarks.dat` (recommended for eye tracking)

## Troubleshooting

If you get errors about missing model files:
1. Verify the file exists in `models/shape_predictor_68_face_landmarks.dat`
2. Check file permissions
3. Ensure the file is not corrupted (try re-downloading)