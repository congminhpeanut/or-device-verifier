import os
import requests

VENDOR_DIR = os.path.join(os.path.dirname(__file__), '..', 'static', 'vendor')

ASSETS = [
    {
        "url": "https://unpkg.com/html5-qrcode/minified/html5-qrcode.min.js",
        "name": "html5-qrcode.min.js"
    },
    {
        "url": "https://unpkg.com/tesseract.js@v5.0.3/dist/tesseract.min.js",
        "name": "tesseract.min.js"
    },
    {
        "url": "https://unpkg.com/tesseract.js@v5.0.3/dist/worker.min.js",
        "name": "worker.min.js"
    },
    {
        "url": "https://unpkg.com/tesseract.js-core@v5.0.0/tesseract-core.wasm.js",
        "name": "tesseract-core.wasm.js"
    },
    {
         "url": "https://unpkg.com/tesseract.js-core@v5.0.0/tesseract-core.wasm.wasm",
         "name": "tesseract-core.wasm.wasm"
    }

]

def download_file(url, filename):
    filepath = os.path.join(VENDOR_DIR, filename)
    print(f"Downloading {url} to {filepath}...")
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"Saved {filepath}")
    except Exception as e:
        print(f"Failed to download {url}: {e}")

if __name__ == "__main__":
    if not os.path.exists(VENDOR_DIR):
        os.makedirs(VENDOR_DIR)
    
    for asset in ASSETS:
        download_file(asset['url'], asset['name'])
        
    print("Vendor assets setup complete.")
