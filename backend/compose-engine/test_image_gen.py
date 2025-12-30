#!/usr/bin/env python3
"""
Test script for Vertex AI image generation with WIF authentication.
"""

import sys
import os

# Set Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from services.vertex_ai import VertexAIClient, ImageGenerationConfig, ImageAspectRatio

print('=' * 70)
print('Vertex AI Image Generation Test with WIF')
print('=' * 70)

try:
    # Create client
    print('\n1. Creating Vertex AI client...')
    client = VertexAIClient()
    print('   ✓ Client created')

    # Test image generation
    print('\n2. Generating image...')
    config = ImageGenerationConfig(
        prompt='A beautiful sunset over the ocean with vibrant orange and purple colors, peaceful and serene atmosphere',
        aspect_ratio=ImageAspectRatio.SQUARE_1_1,
        number_of_images=1,
        safety_filter_level='block_some',
        person_generation='allow_adult'
    )

    print(f'   Prompt: {config.prompt}')
    print(f'   Aspect Ratio: {config.aspect_ratio}')

    result = client.generate_image(config)

    print('\n3. Results:')
    if result.success:
        print('   ✓✓✓ SUCCESS! Image generated! ✓✓✓')
        print('=' * 70)
        if result.image_base64:
            print(f'   Image data length: {len(result.image_base64)} bytes')
            print(f'   Image (base64 preview): {result.image_base64[:100]}...')
        if result.image_uri:
            print(f'   Image GCS URI: {result.image_uri}')
    else:
        print(f'   ✗ Generation failed')
        if result.error:
            print(f'   Error: {result.error}')

except Exception as e:
    print(f'\n✗ Error: {e}')
    import traceback
    traceback.print_exc()

print('\n' + '=' * 70)
