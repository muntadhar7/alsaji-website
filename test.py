import requests
import json


def test_api_calls():
    base_url = "http://localhost:8069"

    endpoints = [
        "/api/alsaji/simple-test",
        "/api/alsaji/products",
        "/api/alsaji/categories",
        "/api/alsaji/brands",
        "/api/alsaji/branches"
    ]

    for endpoint in endpoints:
        print(f"\n{'=' * 50}")
        print(f"Testing: {endpoint}")
        print(f"{'=' * 50}")

        url = base_url + endpoint
        try:
            response = requests.get(url, timeout=10)
            print(f"Status Code: {response.status_code}")
            print(f"Headers: {dict(response.headers)}")

            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"JSON Response: {json.dumps(data, indent=2)}")
                except:
                    print(f"Raw Response: {response.text[:500]}")
            else:
                print(f"Error Response: {response.text[:500]}")

        except Exception as e:
            print(f"Exception: {e}")


if __name__ == "__main__":
    test_api_calls()