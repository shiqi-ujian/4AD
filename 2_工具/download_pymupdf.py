import urllib.request

url = "https://files.pythonhosted.org/packages/44/47/5fb10fe73f96b31253a41647c362ea9e0380920bddf16028414a051247fc/pymupdf-1.27.2.3-cp310-abi3-win_amd64.whl"
filename = "pymupdf.whl"

try:
    print(f"Downloading {url}...")
    urllib.request.urlretrieve(url, filename)
    print(f"Downloaded to {filename}")
except Exception as e:
    print(f"Error: {e}")